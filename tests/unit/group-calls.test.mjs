import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, deps = {}) {
  const source = readFileSync(new URL(`../../src/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    (name) => (name in deps ? deps[name] : require(name)),
    module,
    module.exports
  );
  return module.exports;
}

const exceptions = {
  BaseException: class extends Error {
    constructor(message, httpCode, code) {
      super(message);
      this.httpCode = httpCode;
      this.code = code;
    }
  },
  UnauthorizedException: Error,
  BadRequestException: Error,
  ForbiddenException: Error,
  NotFoundException: Error,
};
const CallMedia = { AUDIO: 'audio', VIDEO: 'video' };
const ConversationEventType = {
  GROUP_CALL_STARTED: 'GROUP_CALL_STARTED',
  GROUP_CALL_ENDED: 'GROUP_CALL_ENDED',
  GROUP_CALL_RING_CLOSED: 'GROUP_CALL_RING_CLOSED',
};
const apiSecret = 'fixture-that-is-only-used-for-tests';
const env = {
  LIVEKIT_API_KEY: 'fixture',
  LIVEKIT_API_SECRET: apiSecret,
  LIVEKIT_API_URL: 'http://livekit:7880',
  LIVEKIT_WS_URL: 'ws://localhost:7880',
};
const { livekitService: livekit } = load('services/livekit.service', {
  '@config/environment': { env },
  '@appTypes': { CallMedia },
  '@exceptions': exceptions,
});

test('join tokens bind the user and room, expire, and prohibit video in an audio call', () => {
  const result = livekit.issueAccess('room-id', 'user-id', 'Ana', CallMedia.AUDIO);
  const claims = jwt.verify(result.token, apiSecret, {
    issuer: env.LIVEKIT_API_KEY,
    algorithms: ['HS256'],
  });
  assert.equal(claims.sub, 'user-id');
  assert.equal(claims.exp - claims.iat, 120);
  assert.deepEqual(claims.video, {
    room: 'room-id',
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canPublishSources: ['microphone'],
  });
  assert.equal(result.url, env.LIVEKIT_WS_URL);
  assert.deepEqual(
    jwt.decode(livekit.issueAccess('room-id', 'user-id', 'Ana', CallMedia.VIDEO).token).video
      .canPublishSources,
    ['microphone', 'camera']
  );
});

test('signing material is used for RoomService, with operation-specific grants', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: url.href, options });
    return new globalThis.Response(JSON.stringify({ name: 'room-id', sid: 'RM_test' }));
  });
  assert.equal((await livekit.createRoom('room-id')).sid, 'RM_test');
  assert.equal(requests[0].url, 'http://livekit:7880/twirp/livekit.RoomService/CreateRoom');
  const token = requests[0].options.headers.authorization.split(' ')[1];
  assert.deepEqual(jwt.verify(token, apiSecret).video, { roomCreate: true });
  assert.equal(JSON.parse(requests[0].options.body).max_participants, 30);
});

test('upstream errors are recoverable, and Twirp not_found is safe on leave or end', async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => new globalThis.Response('{"code":"not_found"}', { status: 404 })
  );
  await livekit.removeParticipant('room-id', 'user-id');
  await livekit.deleteRoom('room-id');
  fetchMock.mock.mockImplementation(
    async () => new globalThis.Response('unavailable', { status: 503 })
  );
  await assert.rejects(livekit.findRoom('room-id'), {
    httpCode: 503,
    code: 'GROUP_CALL:LIVEKIT_UNAVAILABLE',
  });
});

test('ListParticipants ignores disconnected participants and handles an already closed room', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.pathname, '/twirp/livekit.RoomService/ListParticipants');
    assert.deepEqual(JSON.parse(options.body), { room: 'room-id' });
    assert.deepEqual(jwt.verify(options.headers.authorization.split(' ')[1], apiSecret).video, {
      roomAdmin: true,
      room: 'room-id',
    });
    return Response.json({ participants: [{ state: 'DISCONNECTED' }, { state: 'JOINING' }] });
  });
  assert.equal(await livekit.hasParticipants('room-id'), true);
  fetchMock.mock.mockImplementation(async () => Response.json({ participants: [{ state: 3 }] }));
  assert.equal(await livekit.hasParticipants('room-id'), false);
  fetchMock.mock.mockImplementation(async () =>
    Response.json({ code: 'not_found' }, { status: 404 })
  );
  assert.equal(await livekit.hasParticipants('room-id'), false);
});

function signedEvent(event) {
  const body = Buffer.from(JSON.stringify(event));
  const authorization = jwt.sign(
    { sha256: createHash('sha256').update(body).digest('base64') },
    apiSecret,
    {
      issuer: env.LIVEKIT_API_KEY,
      expiresIn: '1m',
    }
  );
  return { body, authorization };
}

test('webhook accepts a signed raw body and rejects altered or unauthenticated events', () => {
  const event = { event: 'room_finished', room: { name: 'room-id', sid: 'RM_test' } };
  const { body, authorization } = signedEvent(event);
  assert.deepEqual(livekit.readWebhook(body, authorization), event);
  assert.throws(() => livekit.readWebhook(Buffer.from('{}'), authorization), /INVALID_WEBHOOK/);
  assert.throws(() => livekit.readWebhook(body), /INVALID_WEBHOOK/);
  assert.throws(() => livekit.readWebhook(event, authorization), /INVALID_WEBHOOK/);
});

function fixture(groupType = 'GROUP') {
  const conversationId = randomUUID(),
    owner = randomUUID(),
    member = randomUUID(),
    third = randomUUID();
  const entities = {
    Conversation: 'Conversation',
    ConversationMember: 'ConversationMember',
    GroupCall: 'GroupCall',
    User: 'User',
  };
  const memberships = new Map([
    [owner, 'OWNER'],
    [member, 'MEMBER'],
    [third, 'MEMBER'],
  ]);
  const calls = [],
    notices = [],
    events = [],
    evictions = [],
    pushes = [],
    rooms = new Map(),
    participants = new Map();
  const row = {
    async findOne(entity, { where }) {
      if (entity === entities.Conversation) {
        return where.id === conversationId && (!where.type || where.type === groupType)
          ? { id: conversationId, name: 'Equipo' }
          : null;
      }
      const role = memberships.get(where.userId);
      return role ? { role } : null;
    },
    async findOneBy(entity, where) {
      if (entity === entities.User) return { id: where.id, username: 'User' };
      return (
        calls.find((call) => Object.entries(where).every(([key, value]) => call[key] === value)) ??
        null
      );
    },
    async findBy(_entity, { ringingUntil }) {
      return calls.filter((call) => call.ringingUntil && call.ringingUntil <= ringingUntil);
    },
    async existsBy(_entity, where) {
      return memberships.has(where.userId);
    },
    create(_entity, input) {
      return input;
    },
    async save(_entity, call) {
      if (!calls.includes(call)) {
        call.createdAt = new Date();
        calls.push(call);
      }
      return call;
    },
  };
  let transaction = Promise.resolve();
  const { groupCallService: service } = load('services/group-call.service', {
    typeorm: { IsNull: () => null, LessThanOrEqual: (date) => date },
    '@config/database': {
      AppDataSource: {
        manager: row,
        transaction: (run) => {
          const result = transaction.then(() => run(row));
          transaction = result.catch(() => {});
          return result;
        },
      },
    },
    '@appTypes': {
      CallMedia,
      ConversationEventType,
      ConversationRole: { OWNER: 'OWNER' },
      ConversationType: { GROUP: 'GROUP' },
    },
    '@constants': { WS_SERVER_EVENTS: ConversationEventType, CALL_RING_TIMEOUT_MS: 60_000 },
    '@entities': entities,
    '@exceptions': exceptions,
    '@repositories': {
      ConversationEventRepository: {
        async createEvent(event) {
          events.push(event);
          return event;
        },
      },
      ConversationMemberRepository: {
        async getMembers() {
          return [...memberships.keys()].map((userId) => ({ userId }));
        },
      },
    },
    '@websocket/managers/connection-manager': {
      connectionManager: { getUserConnections: (id) => [id] },
    },
    '@websocket/send-message': {
      sendMessage: (userId, notice) => notices.push({ userId, ...notice }),
    },
    './push-notification.service': {
      pushNotificationService: {
        async sendToUser(userId, payload, options) {
          pushes.push({ userId, ...payload, options });
        },
      },
    },
    './livekit.service': {
      livekitService: {
        issueAccess: livekit.issueAccess.bind(livekit),
        readWebhook: livekit.readWebhook.bind(livekit),
        assertConfigured() {},
        async createRoom(name) {
          const room = { name, sid: randomUUID() };
          rooms.set(name, room);
          participants.set(name, new Set());
          return room;
        },
        async findRoom(name) {
          return rooms.get(name);
        },
        async hasParticipants(name) {
          return !!participants.get(name)?.size;
        },
        async deleteRoom(name) {
          rooms.delete(name);
          participants.delete(name);
        },
        async removeParticipant(name, userId) {
          evictions.push([name, userId]);
          participants.get(name)?.delete(userId);
        },
      },
    },
  });
  return {
    service,
    conversationId,
    owner,
    member,
    third,
    rooms,
    participants,
    calls,
    memberships,
    events,
    notices,
    evictions,
    pushes,
  };
}

test('simultaneous starts share one room, and only active members can obtain join access', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([
    f.service.start(f.conversationId, f.owner, CallMedia.AUDIO),
    f.service.start(f.conversationId, f.member, CallMedia.VIDEO),
  ]);
  assert.equal(a.call.id, b.call.id);
  assert.equal(b.call.media, CallMedia.AUDIO);
  assert.equal(f.rooms.size, 1);
  const credentials = await f.service.join(f.conversationId, a.call.id, f.third);
  assert.equal(jwt.decode(credentials.token).sub, f.third);
  await assert.rejects(f.service.join(f.conversationId, a.call.id, randomUUID()), /NOT_A_MEMBER/);
  await assert.rejects(f.service.join(f.conversationId, randomUUID(), f.third), /NOT_ACTIVE/);
  assert.ok(f.notices.every((notice) => !JSON.stringify(notice).includes(credentials.token)));
  assert.deepEqual(
    f.events.map(({ type }) => type),
    ['GROUP_CALL_STARTED']
  );
});

test('a private conversation cannot start a group call', async () => {
  const f = fixture('PRIVATE');
  await assert.rejects(
    f.service.start(f.conversationId, f.owner, CallMedia.VIDEO),
    /GROUP_NOT_FOUND/
  );
  assert.equal(f.rooms.size, 0);
});

test('leaving only removes the current user, and only the initiator or group owner can end', async () => {
  const f = fixture();
  const { call } = await f.service.start(f.conversationId, f.member, CallMedia.VIDEO);
  f.participants.get(`group-call-${call.id}`).add(f.member);
  await f.service.leave(f.conversationId, call.id, f.third);
  assert.deepEqual(f.evictions, [[`group-call-${call.id}`, f.third]]);
  await assert.rejects(f.service.end(f.conversationId, call.id, f.third), /CANNOT_END/);
  assert.equal(f.rooms.size, 1);
  await f.service.end(f.conversationId, call.id, f.owner);
  await f.service.end(f.conversationId, call.id, f.owner);
  assert.equal(f.rooms.size, 0);
  assert.equal(await f.service.getActive(f.conversationId, f.owner), null);
  assert.equal(f.events.filter((event) => event.type === 'GROUP_CALL_ENDED').length, 1);
});

test('webhooks evict removed users and close only the matching room', async () => {
  const f = fixture();
  await f.service.start(f.conversationId, f.owner, CallMedia.VIDEO);
  const [room] = f.rooms.values();
  f.memberships.delete(f.member);
  for (const [event, payload] of [
    ['participant_joined', { room, participant: { identity: f.member } }],
    ['room_finished', { room: { ...room, sid: 'wrong' } }],
  ]) {
    const { body, authorization } = signedEvent({ event, ...payload });
    await f.service.receiveWebhook(body, authorization);
  }
  assert.deepEqual(f.evictions, [[room.name, f.member]]);
  assert.equal(f.calls[0].endedAt, null);
  const { body, authorization } = signedEvent({ event: 'room_finished', room });
  await f.service.receiveWebhook(body, authorization);
  await f.service.receiveWebhook(body, authorization);
  assert.ok(f.calls[0].endedAt);
  assert.equal(f.events.filter((event) => event.type === 'GROUP_CALL_ENDED').length, 1);
});

test('when the last member leaves, the conversation is updated before LiveKit departure timeout', async () => {
  const f = fixture();
  const { call } = await f.service.start(f.conversationId, f.owner, CallMedia.AUDIO);
  const [room] = f.rooms.values();
  f.participants.get(room.name).add(f.owner).add(f.member);
  await f.service.leave(f.conversationId, call.id, f.owner);
  assert.equal((await f.service.getActive(f.conversationId, f.owner)).id, call.id);

  // Disconnecting over WebRTC can arrive before or instead of the HTTP leave request.
  f.participants.get(room.name).delete(f.member);
  const { body, authorization } = signedEvent({
    event: 'participant_left',
    room,
    participant: { identity: f.member },
  });
  await f.service.receiveWebhook(body, authorization);
  await f.service.leave(f.conversationId, call.id, f.member);

  assert.equal(f.rooms.size, 0);
  assert.equal(await f.service.getActive(f.conversationId, f.owner), null);
  const ended = f.events.filter((event) => event.type === 'GROUP_CALL_ENDED');
  assert.equal(ended.length, 1);
  assert.equal(ended[0].actorId, f.member);
  assert.equal(f.notices.filter((entry) => entry.type === 'GROUP_CALL_ENDED').length, 3);
});

test('an aborted initial connection leaves the room open for a TURN retry', async () => {
  const f = fixture();
  const { call } = await f.service.start(f.conversationId, f.owner, CallMedia.AUDIO);
  const [room] = f.rooms.values();
  const { body, authorization } = signedEvent({
    event: 'participant_connection_aborted',
    room,
    participant: { identity: f.owner },
  });
  await f.service.receiveWebhook(body, authorization);

  assert.equal((await f.service.getActive(f.conversationId, f.owner)).id, call.id);
  assert.equal((await f.service.join(f.conversationId, call.id, f.owner)).call.id, call.id);

  // The client calls leave if connection retries are exhausted.
  await f.service.leave(f.conversationId, call.id, f.owner);
  assert.equal(await f.service.getActive(f.conversationId, f.member), null);
});

test('an expired room is reconciled before a replacement is opened', async () => {
  const f = fixture();
  const first = await f.service.start(f.conversationId, f.owner, CallMedia.VIDEO);
  f.rooms.clear();
  const second = await f.service.start(f.conversationId, f.member, CallMedia.AUDIO);
  assert.notEqual(first.call.id, second.call.id);
  assert.ok(f.calls[0].endedAt);
  assert.equal(f.calls[1].endedAt, null);
});

test('group rings reach only other active members, and accepting or rejecting affects only that member', async () => {
  const f = fixture();
  const { call, created } = await f.service.start(f.conversationId, f.owner, CallMedia.VIDEO);
  assert.equal(created, true);
  const incoming = f.pushes.filter(({ data }) => data.type === 'group-call-incoming');
  assert.deepEqual(
    incoming.map(({ userId }) => userId),
    [f.member, f.third]
  );
  assert.ok(
    incoming.every(
      ({ data, options }) =>
        data.callId === call.id &&
        data.conversationId === f.conversationId &&
        data.groupName === 'Equipo' &&
        data.media === 'video' &&
        options.TTL <= 60
    )
  );
  await f.service.decline(f.conversationId, call.id, f.third);
  await assert.rejects(f.service.join(f.conversationId, call.id, f.third, true), /NOT_ACTIVE/);
  await f.service.join(f.conversationId, call.id, f.member, true);
  assert.ok(
    f.notices.some(({ userId, type }) => userId === f.owner && type === 'GROUP_CALL_RING_CLOSED')
  );
  assert.equal((await f.service.getActive(f.conversationId, f.owner)).id, call.id);
  assert.equal((await f.service.start(f.conversationId, f.owner, CallMedia.VIDEO)).created, false);
  assert.equal(f.pushes.filter(({ data }) => data.type === 'group-call-incoming').length, 2);
});

test('only unanswered members are notified when group ringing expires, and expiry is idempotent', async () => {
  const f = fixture();
  const { call } = await f.service.start(f.conversationId, f.owner, CallMedia.AUDIO);
  await f.service.join(f.conversationId, call.id, f.member, true);
  f.calls[0].ringingUntil = new Date(Date.now() - 1000);
  await f.service.expireRinging();
  await f.service.expireRinging();
  const missed = f.pushes.filter(({ data }) => data.type === 'group-call-missed');
  assert.deepEqual(
    missed.map(({ userId }) => userId),
    [f.third]
  );
  await assert.rejects(f.service.join(f.conversationId, call.id, f.third, true), /NOT_ACTIVE/);
  assert.equal((await f.service.join(f.conversationId, call.id, f.third)).call.id, call.id);
});
