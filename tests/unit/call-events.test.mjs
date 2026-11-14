import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(path, dependencies) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports
  );
  return module.exports;
}

function fixture(changed = true, hasConversation = true) {
  const saved = [];
  const call = {
    id: 'call',
    conversationId: hasConversation ? 'conversation' : null,
    callerId: 'alice',
    calleeId: 'bob',
    media: 'audio',
    status: 'ended',
    acceptedAt: new Date(0),
    connectedAt: new Date(1000),
    endedAt: new Date(66500),
  };
  const result = { call, changed };
  let expired = false;
  const { CallService } = load('../../src/services/call.service.ts', {
    '@exceptions': { ForbiddenException: Error, NotFoundException: Error },
    '@appTypes': {
      ConversationType: { PRIVATE: 'PRIVATE' },
      CallStatus: { MISSED: 'missed' },
      ConversationEventType: {
        CALL_ACCEPTED: 'CALL_ACCEPTED',
        CALL_END: 'CALL_END',
      },
    },
    '@repositories': {
      CallRepository: {
        acceptIfRinging: async () => result,
        endIfAllowed: async () => result,
        rejectIfRinging: async () => result,
        timeoutIfExpired: async () => {
          if (!changed || expired) return null;
          expired = true;
          return call;
        },
        expireRinging: async () => {
          if (!changed || expired) return [];
          expired = true;
          return [call];
        },
        findOne: async () => call,
      },
      ConversationEventRepository: {
        createEvent: async (event) => {
          const persisted = { ...event, id: `event-${saved.length}` };
          saved.push(persisted);
          return persisted;
        },
      },
    },
    '@utils': {},
  });
  return { service: new CallService(), saved, call };
}

test('accept does not create a conversation event', async () => {
  const { service, saved, call } = fixture();
  const result = await service.accept('bob', 'connection', 'call');
  assert.equal(result.call, call);
  assert.equal(result.conversationEvent, undefined);
  assert.equal(saved.length, 0);
});

test('CALL_END creates one CALL_ACCEPTED event with the connected duration', async () => {
  const { service, saved } = fixture();
  const result = await service.end('alice', 'call');
  assert.equal(result.conversationEvent, saved[0]);
  assert.equal(saved[0].type, 'CALL_ACCEPTED');
  assert.equal(saved[0].createdAt, result.call.endedAt);
  assert.equal(saved[0].metadata.durationSeconds, 65);
});

test('retries do not create another conversation event', async () => {
  const { service, saved } = fixture(false);
  await service.accept('bob', 'connection', 'call');
  await service.end('alice', 'call');
  assert.equal(saved.length, 0);
});

test('socket delivery sends the saved event only when the socket is open', () => {
  const { sendMessage } = load('../../src/websocket/send-message.ts', {
    ws: { WebSocket: { OPEN: 1 } },
  });
  const sent = [];
  const socket = { readyState: 3, send: (value) => sent.push(JSON.parse(value)) };
  const message = { type: 'CALL_END', data: { conversationEvent: { id: 'saved-event' } } };
  sendMessage({ socket }, message);
  assert.equal(sent.length, 0);
  socket.readyState = 1;
  sendMessage({ socket }, message);
  assert.deepEqual(sent, [message]);
});

test('legacy calls without conversationId keep working without creating an event', async () => {
  const { service, saved, call } = fixture(true, false);
  const accepted = await service.accept('bob', 'connection', 'call');
  const ended = await service.end('alice', 'call');
  assert.equal(accepted.call, call);
  assert.equal(ended.call, call);
  assert.equal(accepted.conversationEvent, undefined);
  assert.equal(ended.conversationEvent, undefined);
  assert.equal(saved.length, 0);
});

test('CALL_INIT retains the supplied conversationId after checking both participants', async () => {
  const checked = [];
  let persisted;
  const { CallService } = load('../../src/services/call.service.ts', {
    '@exceptions': { ForbiddenException: Error, NotFoundException: Error },
    '@appTypes': { CallMedia: { AUDIO: 'audio', VIDEO: 'video' } },
    '@repositories': {
      UserRepository: { findOne: async () => ({ id: 'bob' }) },
      ConversationMemberRepository: {
        exists: async (...args) => {
          checked.push(args);
          return true;
        },
      },
      CallRepository: {
        createIfParticipantsAvailable: async (data) => {
          persisted = data;
          return { call: { ...data, id: 'call' }, created: true };
        },
      },
    },
    '@utils': {},
  });
  await new CallService().init('alice', 'connection', {
    calleeId: 'bob',
    conversationId: 'conversation',
    media: 'audio',
    requestId: 'request',
  });
  assert.equal(persisted.conversationId, 'conversation');
  assert.deepEqual(checked, [
    ['conversation', 'alice'],
    ['conversation', 'bob'],
  ]);
});

test('ending an unanswered call creates CALL_END without duration', async () => {
  const { service, saved, call } = fixture();
  call.acceptedAt = null;
  call.connectedAt = null;
  await service.end('alice', 'call');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].type, 'CALL_END');
  assert.equal(saved[0].metadata.durationSeconds, 0);
});

test('reject creates a CALL_END event with rejected status', async () => {
  const { service, saved, call } = fixture();
  Object.assign(call, { status: 'rejected', acceptedAt: null, connectedAt: null });
  const result = await service.reject('bob', 'call');
  assert.equal(saved.length, 1);
  assert.equal(result.conversationEvent, saved[0]);
  assert.equal(saved[0].type, 'CALL_END');
  assert.equal(saved[0].actorId, 'bob');
  assert.equal(saved[0].metadata.status, 'rejected');
  assert.equal(saved[0].metadata.durationSeconds, 0);
});

test('reject retries do not create or resend another conversation event', async () => {
  const { service, saved } = fixture(false);
  const result = await service.reject('bob', 'call');
  assert.equal(saved.length, 0);
  assert.equal(result.conversationEvent, undefined);
});

test('CALL_REJECT delivers the saved rejection event to both participants', async () => {
  const { service, call, saved } = fixture();
  Object.assign(call, { status: 'rejected', acceptedAt: null, connectedAt: null });
  const sent = [];
  const { callRejectHandler } = load('../../src/websocket/handlers/call-reject.ts', {
    '@constants': { WS_SERVER_EVENTS: { CALL_REJECT: 'CALL_REJECT' } },
    '@dtos': { CallReferenceSchema: { parse: (data) => data } },
    '@services': { callService: service },
    '../authenticate-guard': { requireAuthentication() {} },
    '../managers/connection-manager': {
      connectionManager: {
        getUserConnections: (userId) => [{ id: userId, userId }],
      },
    },
    '../send-message': { sendMessage: (connection, message) => sent.push({ connection, message }) },
  });
  await callRejectHandler({
    connection: { id: 'bob', userId: 'bob' },
    message: { data: { callId: 'call' } },
  });
  assert.deepEqual(
    sent.map((item) => item.connection.userId),
    ['alice', 'bob']
  );
  for (const { message } of sent) {
    assert.equal(message.type, 'CALL_REJECT');
    assert.equal(message.data.conversationEvent, saved[0]);
    assert.equal(message.data.conversationEvent.metadata.status, 'rejected');
  }
});

test('client timeout creates one missed event and retries do not create another', async () => {
  const { service, call, saved } = fixture();
  Object.assign(call, { status: 'missed', acceptedAt: null, connectedAt: null });
  const result = await service.timeout('alice', 'connection', call.id);
  assert.equal(result.conversationEvent, saved[0]);
  assert.equal(saved[0].type, 'CALL_END');
  assert.equal(saved[0].metadata.status, 'missed');
  assert.equal(saved[0].metadata.media, 'audio');
  assert.equal(saved[0].metadata.durationSeconds, 0);
  assert.equal(saved[0].createdAt, call.endedAt);
  assert.equal(await service.timeout('alice', 'connection', call.id), null);
  assert.equal(saved.length, 1);
});

test('server expiration creates the missed event and returns it for notification', async () => {
  const { service, call, saved } = fixture();
  Object.assign(call, { status: 'missed', acceptedAt: null, connectedAt: null });
  const results = await service.expireRinging();
  assert.equal(results.length, 1);
  assert.equal(results[0].conversationEvent, saved[0]);
  assert.equal(saved[0].conversationId, call.conversationId);
  assert.equal(saved[0].metadata.status, 'missed');
  assert.deepEqual(await service.expireRinging(), []);
  assert.equal(await service.timeout('alice', 'connection', call.id), null);
  assert.equal(saved.length, 1);
});

test('missed call notification delivers the saved event to both participants', () => {
  const sent = [];
  const { notifyCallNoAnswer } = load('../../src/websocket/handlers/notify-call-no-answer.ts', {
    '@services': { pushNotificationService: { sendToUser: async () => {} } },
    '@appTypes': { CallStatus: { MISSED: 'missed' } },
    '@constants': { WS_SERVER_EVENTS: { CALL_END: 'CALL_END' } },
    '../managers/connection-manager': {
      connectionManager: {
        getUserConnections: (userId) => [{ userId }],
      },
    },
    '../send-message': { sendMessage: (connection, message) => sent.push({ connection, message }) },
  });
  const conversationEvent = { id: 'missed-event', metadata: { status: 'missed' } };
  notifyCallNoAnswer({
    callId: 'call',
    callerId: 'alice',
    calleeId: 'bob',
    callerName: 'Alice',
    endedAt: new Date(),
    conversationEvent,
  });
  assert.deepEqual(
    sent.map((item) => item.connection.userId),
    ['alice', 'bob']
  );
  for (const { message } of sent) {
    assert.equal(message.type, 'CALL_END');
    assert.equal(message.data.status, 'missed');
    assert.equal(message.data.conversationEvent, conversationEvent);
  }
});
