import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, dependencies) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => {
      if (name in dependencies) return dependencies[name];
      if (name === 'typeorm') return require(name);
      throw new Error(`Unexpected dependency ${name}`);
    },
    module,
    module.exports
  );
  return module.exports;
}
function matches(item, where) {
  if (Array.isArray(where)) return where.some((condition) => matches(item, condition));
  return Object.entries(where).every(([key, value]) => {
    if (value?.type === 'in') return value.value.includes(item[key]);
    if (value?.type === 'not' && value.child?.type === 'isNull') return item[key] != null;
    if (value?.type === 'isNull') return item[key] == null;
    if (value?.type === 'lessThan') return item[key] < value.value;
    if (value instanceof Date) return item[key].getTime() === value.getTime();
    return item[key] === value;
  });
}
function fixture() {
  const rows = [
    { id: '3', callerId: 'alice', calleeId: 'bob', createdAt: new Date(3000), status: 'ended' },
    { id: '2', callerId: 'bob', calleeId: 'alice', createdAt: new Date(2000), status: 'ringing' },
    { id: '1', callerId: 'bob', calleeId: 'carol', createdAt: new Date(1000), status: 'missed' },
  ];
  const repository = {
    extend(methods) {
      return Object.assign(this, methods);
    },
    manager: {
      transaction: async (callback) =>
        callback({
          getRepository: (name) => (name === 'ConversationEvent' ? eventRepository : repository),
        }),
    },
    findOne: async ({ where }) => rows.find((item) => matches(item, where)) ?? null,
    find: async ({ where, take }) =>
      rows
        .filter((item) => matches(item, where))
        .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id))
        .slice(0, take ?? rows.length),
    delete: async (ids) => {
      for (let i = rows.length - 1; i >= 0; i--) if (ids.includes(rows[i].id)) rows.splice(i, 1);
    },
    update: async (where, patch) => {
      const matched = rows.filter((item) => matches(item, where));
      matched.forEach((item) => Object.assign(item, patch));
      return { affected: matched.length };
    },
  };
  const { CallRepository } = load('../../src/repositories/call.repository.ts', {
    '@config/database': { AppDataSource: { getRepository: () => repository } },
    '@constants': {},
    '@appTypes': {
      CallStatus: { ENDED: 'ended', REJECTED: 'rejected', MISSED: 'missed', FAILED: 'failed' },
    },
    '@entities': { Call: 'Call' },
    './call-negotiation.repository': {},
    './conversation-event.repository': {
      get ConversationEventRepository() {
        return eventRepository;
      },
    },
  });
  const events = [
    { id: 'event-3', conversationId: 'chat', type: 'CALL_ACCEPTED', metadata: { callId: '3' } },
    { id: 'event-2', conversationId: 'chat', type: 'CALL_END', metadata: { callId: '2' } },
    { id: 'event-1', conversationId: 'chat', type: 'CALL_END', metadata: { callId: '1' } },
    { id: 'group-event', conversationId: 'chat', type: 'GROUP_CREATED', metadata: {} },
  ];
  const eventRepository = {
    delete: async (where) => {
      const ids = where.metadata.objectLiteralParameters.deletedCallIds;
      for (let i = events.length - 1; i >= 0; i--) {
        if (ids.includes(events[i].metadata.callId) && where.type.value.includes(events[i].type))
          events.splice(i, 1);
      }
    },
    extend(methods) {
      return Object.assign(this, methods);
    },
    find: async ({ where }) =>
      events.filter((event) => {
        if (event.conversationId !== where.conversationId) return false;
        const userId = where.metadata?.objectLiteralParameters?.historyUserId;
        const call = rows.find((row) => row.id === event.metadata.callId);
        if (!userId || !call) return true;
        return !(
          (call.callerId === userId && call.callerHistoryDeletedAt) ||
          (call.calleeId === userId && call.calleeHistoryDeletedAt)
        );
      }),
  };
  const { ConversationEventRepository } = load(
    '../../src/repositories/conversation-event.repository.ts',
    {
      '@config/database': { AppDataSource: { getRepository: () => eventRepository } },
      '@appTypes': {
        ConversationEventType: { CALL_ACCEPTED: 'CALL_ACCEPTED', CALL_END: 'CALL_END' },
      },
      '@entities': { ConversationEvent: 'ConversationEvent', Call: 'Call' },
    }
  );
  const { paginate } = load('../../src/utils/pagination.ts', {});
  const { callService } = load('../../src/services/call.service.ts', {
    '@exceptions': { NotFoundException: Error },
    '@appTypes': {},
    '@repositories': { CallRepository },
    '@utils': { paginate },
  });
  return { rows, rawEvents: events, service: callService, events: ConversationEventRepository };
}
test('history is scoped to the authenticated participant and paginated newest first', async () => {
  const { service } = fixture();
  const first = await service.getHistory('alice', { limit: 1 });
  assert.deepEqual(
    first.page.map((item) => item.id),
    ['3']
  );
  assert.equal(first.nextCursor, '3000.3');
  const second = await service.getHistory('alice', { limit: 1, cursor: first.nextCursor });
  assert.deepEqual(
    second.page.map((item) => item.id),
    ['2']
  );
  assert.equal(second.nextCursor, null);
});
test('deleting one entry hides it only for that participant and preserves the call', async () => {
  const { rows, service } = fixture();
  await service.deleteHistory('alice', '3');
  assert.deepEqual(
    (await service.getHistory('alice', { limit: 20 })).page.map((item) => item.id),
    ['2']
  );
  assert.deepEqual(
    (await service.getHistory('bob', { limit: 20 })).page.map((item) => item.id),
    ['3', '2', '1']
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].status, 'ended');
  // A cursor still works after the user removes its history entry.
  assert.deepEqual(
    (await service.getHistory('alice', { limit: 20, cursor: '3' })).page.map((item) => item.id),
    ['2']
  );
});
test('a user cannot delete another users call history entry', async () => {
  const { rows, service } = fixture();
  await assert.rejects(service.deleteHistory('alice', '1'), /CALL_HISTORY_NOT_FOUND/);
  assert.equal(rows[2].callerHistoryDeletedAt, undefined);
  assert.equal(rows[2].calleeHistoryDeletedAt, undefined);
});
test('delete all clears both directions only for the authenticated user and preserves signaling', async () => {
  const { rows, service } = fixture();
  await service.deleteAllHistory('alice');
  assert.deepEqual((await service.getHistory('alice', { limit: 20 })).page, []);
  assert.equal((await service.getHistory('bob', { limit: 20 })).page.length, 3);
  assert.equal(rows[1].status, 'ringing');
  await service.deleteAllHistory('alice');
  assert.equal(rows.length, 3);
});
test('all three call history routes authenticate and authorize the requested roles', () => {
  const registered = [];
  const router = Object.fromEntries(
    ['get', 'post', 'delete', 'patch'].map((method) => [
      method,
      (path, ...handlers) => registered.push({ method, path, handlers }),
    ])
  );
  const authenticate = () => {};
  const authorize = (...roles) => Object.assign(() => {}, { roles });
  const schemas = new Proxy({}, { get: () => ({ pick: () => ({}) }) });
  const controllers = new Proxy({}, { get: () => () => {} });
  load('../../src/routes/v1/index.ts', {
    express: { Router: () => router },
    '@appTypes': { UserRole: { USER: 'USER', ADMIN: 'ADMIN', SUPER_ADMIN: 'SUPER_ADMIN' } },
    '@middlewares': { authenticate, authorize, validateDTO: () => () => {} },
    '@dtos': schemas,
    '@controllers': controllers,
  });
  const histories = registered.filter((route) => route.path.startsWith('/call/histories'));
  assert.deepEqual(
    histories.map(({ method, path }) => [method, path]),
    [
      ['get', '/call/histories'],
      ['delete', '/call/histories/:callId'],
      ['delete', '/call/histories'],
    ]
  );
  for (const { handlers } of histories) {
    assert.equal(handlers[0], authenticate);
    assert.deepEqual(handlers[1].roles, ['USER', 'ADMIN', 'SUPER_ADMIN']);
  }
});

test('removing one history entry also hides its event only for the deleting participant', async () => {
  const { service, events } = fixture();
  await service.deleteHistory('alice', '3');
  const alice = await events.findByConversation({
    conversationId: 'chat',
    userId: 'alice',
    limit: 20,
  });
  const bob = await events.findByConversation({ conversationId: 'chat', userId: 'bob', limit: 20 });
  assert.ok(!alice.some((event) => event.id === 'event-3'));
  assert.ok(alice.some((event) => event.id === 'event-2'));
  assert.ok(alice.some((event) => event.id === 'group-event'));
  assert.ok(bob.some((event) => event.id === 'event-3'));
});

test('removing all history hides related events in both directions and retains other events', async () => {
  const { service, events } = fixture();
  await service.deleteAllHistory('alice');
  const alice = await events.findByConversation({
    conversationId: 'chat',
    userId: 'alice',
    limit: 20,
  });
  const bob = await events.findByConversation({ conversationId: 'chat', userId: 'bob', limit: 20 });
  assert.deepEqual(
    alice.map((event) => event.id),
    ['event-1', 'group-event']
  );
  assert.equal(bob.length, 4);
});

test('the call event query filters by its participants history deletion flags', async () => {
  let options;
  const repository = {
    extend(methods) {
      return Object.assign(this, methods);
    },
    find: async (value) => {
      options = value;
      return [];
    },
  };
  const { ConversationEventRepository } = load(
    '../../src/repositories/conversation-event.repository.ts',
    {
      '@config/database': { AppDataSource: { getRepository: () => repository } },
      '@appTypes': {
        ConversationEventType: { CALL_ACCEPTED: 'CALL_ACCEPTED', CALL_END: 'CALL_END' },
      },
      '@entities': { ConversationEvent: 'ConversationEvent', Call: 'Call' },
    }
  );
  await ConversationEventRepository.findByConversation({
    conversationId: 'chat',
    userId: 'alice',
    limit: 20,
  });
  const sql = options.where.metadata.getSql('event.metadata');
  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /caller_history_deleted_at IS NOT NULL/);
  assert.match(sql, /callee_history_deleted_at IS NOT NULL/);
  assert.equal(options.where.metadata.objectLiteralParameters.historyUserId, 'alice');
});

test('history deletion notifications are sent only to the deleting users connections', () => {
  const sent = [];
  const { notifyCallHistoryDeleted } = load(
    '../../src/websocket/handlers/notify-call-history-deleted.ts',
    {
      '@constants': { WS_SERVER_EVENTS: { CALL_HISTORY_DELETED: 'CALL_HISTORY_DELETED' } },
      '../managers/connection-manager': {
        connectionManager: {
          getUserConnections: (userId) => [
            { userId, id: 'web' },
            { userId, id: 'mobile' },
          ],
        },
      },
      '../send-message': {
        sendMessage: (connection, message) => sent.push({ connection, message }),
      },
    }
  );
  notifyCallHistoryDeleted('alice', 'call');
  assert.equal(sent.length, 2);
  for (const { connection, message } of sent) {
    assert.equal(connection.userId, 'alice');
    assert.equal(message.type, 'CALL_HISTORY_DELETED');
    assert.equal(message.data.callId, 'call');
  }
});

test('the second participant deletion physically removes the call and its related events', async () => {
  const { rows, rawEvents, service } = fixture();
  await service.deleteHistory('alice', '3');
  assert.ok(rows.some((row) => row.id === '3'));
  assert.ok(rawEvents.some((event) => event.id === 'event-3'));
  await service.deleteHistory('bob', '3');
  assert.ok(!rows.some((row) => row.id === '3'));
  assert.ok(!rawEvents.some((event) => event.id === 'event-3'));
  assert.ok(rows.some((row) => row.id === '1'));
  assert.ok(rawEvents.some((event) => event.id === 'group-event'));
});

test('bulk deletion purges only completed calls removed by both participants', async () => {
  const { rows, rawEvents, service } = fixture();
  await service.deleteAllHistory('alice');
  await service.deleteAllHistory('bob');
  assert.deepEqual(
    rows.map((row) => row.id),
    ['2', '1']
  );
  assert.ok(!rawEvents.some((event) => event.id === 'event-3'));
  assert.ok(rawEvents.some((event) => event.id === 'event-1'));
  assert.equal(rows.find((row) => row.id === '2').status, 'ringing');
  rows.find((row) => row.id === '2').status = 'ended';
  await service.purgeDeletedHistory();
  assert.deepEqual(
    rows.map((row) => row.id),
    ['1']
  );
  assert.ok(!rawEvents.some((event) => event.id === 'event-2'));
  assert.ok(rawEvents.some((event) => event.id === 'group-event'));
});

test('pagination continues with the timestamp cursor after its call is physically deleted', async () => {
  const { rows, service } = fixture();
  const first = await service.getHistory('alice', { limit: 1 });
  await service.deleteHistory('alice', '3');
  await service.deleteHistory('bob', '3');
  assert.ok(!rows.some((row) => row.id === '3'));
  const second = await service.getHistory('alice', { limit: 1, cursor: first.nextCursor });
  assert.deepEqual(
    second.page.map((row) => row.id),
    ['2']
  );
});

test('event creation ignores a call that was already physically removed', async () => {
  let saved = false;
  const eventRepository = {
    extend(methods) {
      return Object.assign(this, methods);
    },
    create: (value) => value,
    save: async () => {
      saved = true;
    },
  };
  const manager = {
    getRepository: (name) => (name === 'Call' ? { findOne: async () => null } : eventRepository),
  };
  const { ConversationEventRepository } = load(
    '../../src/repositories/conversation-event.repository.ts',
    {
      '@config/database': { AppDataSource: { getRepository: () => eventRepository } },
      '@appTypes': {
        ConversationEventType: { CALL_ACCEPTED: 'CALL_ACCEPTED', CALL_END: 'CALL_END' },
      },
      '@entities': { ConversationEvent: 'ConversationEvent', Call: 'Call' },
    }
  );
  const result = await ConversationEventRepository.createEvent(
    { type: 'CALL_END', metadata: { callId: 'removed-call' } },
    manager
  );
  assert.equal(result, undefined);
  assert.equal(saved, false);
});

test('the expiration job purges deleted calls after lifecycle cleanup', async () => {
  let tick;
  const operations = [];
  const task = (name) => async () => {
    operations.push(name);
    return [];
  };
  load('../../src/jobs/expire-calls-job.ts', {
    'node-cron': {
      __esModule: true,
      default: {
        schedule: (_expression, callback) => {
          tick = callback;
          return {};
        },
      },
    },
    '@config/logger': { logger: { info() {} } },
    '@services': {
      callService: {
        expireRinging: task('ringing'),
        expireConnecting: task('connecting'),
        expireRecovery: task('recovery'),
        purgeDeletedHistory: task('purge'),
      },
      callNegotiationService: { expirePending: task('negotiations') },
    },
    '../services/group-call.service': {
      groupCallService: { expireRinging: task('group-ringing') },
    },
    '@websocket/handlers/notify-call-no-answer': {},
    '@websocket/handlers/notify-call-connection-timeout': {},
    '@websocket/handlers/notify-call-negotiation-end': {},
    '@websocket/handlers/notify-call-recovery-timeout': {},
  });
  await tick();
  assert.deepEqual(operations, [
    'ringing',
    'connecting',
    'recovery',
    'negotiations',
    'purge',
    'group-ringing',
  ]);
});

test('history cursors accept legacy UUIDs and timestamp cursors but reject malformed values', () => {
  const { HistoryCursorSchema } = load('../../src/dtos/history-cursor.dto.ts', {
    zod: require('zod'),
  });
  const id = '97070838-624d-4a5b-b677-c9ecbd7f4b50';
  assert.equal(HistoryCursorSchema.safeParse(id).success, true);
  assert.equal(HistoryCursorSchema.safeParse(`1794675600000.${id}`).success, true);
  assert.equal(HistoryCursorSchema.safeParse(`NaN.${id}`).success, false);
  assert.equal(HistoryCursorSchema.safeParse('1794675600000.invalid').success, false);
});
