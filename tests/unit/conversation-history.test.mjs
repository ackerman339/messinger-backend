import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(
  new URL('../../src/services/message.service.ts', import.meta.url),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText;
function fixture(messages, events, deletedIds = []) {
  const rows = {
    Message: messages.map((item) => ({ conversationId: 'conversation', ...item })),
    ConversationEvent: events.map((item) => ({ conversationId: 'conversation', ...item })),
  };
  const repositories = Object.fromEntries(
    Object.entries(rows).map(([entity, items]) => [
      entity,
      {
        extend(methods) {
          return Object.assign(this, methods);
        },
        async findOne({ where }) {
          return (
            items.find(
              (item) =>
                !deletedIds.includes(item.id) &&
                item.id === where.id &&
                item.conversationId === where.conversationId
            ) ?? null
          );
        },
        async find({ where, order, take }) {
          return items
            .filter(
              (item) =>
                !deletedIds.includes(item.id) &&
                item.conversationId === where.conversationId &&
                (!where.createdAt ||
                  (where.createdAt.type === 'lessThan' && item.createdAt < where.createdAt.value))
            )
            .sort((a, b) =>
              order.createdAt === 'DESC' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
            )
            .slice(0, take);
        },
      },
    ])
  );
  for (const [entity, file] of [
    ['Message', 'message.repository'],
    ['ConversationEvent', 'conversation-event.repository'],
  ]) {
    const repositorySource = fs.readFileSync(
      new URL(`../../src/repositories/${file}.ts`, import.meta.url),
      'utf8'
    );
    const repositoryCode = ts.transpileModule(repositorySource, {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const repositoryModule = { exports: {} };
    const repositoryDependencies = {
      '@config/database': { AppDataSource: { getRepository: (name) => repositories[name] } },
      '@entities': { Message: 'Message', ConversationEvent: 'ConversationEvent' },
      '@appTypes': {
        ConversationEventType: { CALL_ACCEPTED: 'CALL_ACCEPTED', CALL_END: 'CALL_END' },
      },
    };
    new Function('require', 'module', 'exports', repositoryCode)(
      (name) => (name === 'typeorm' ? require(name) : repositoryDependencies[name]),
      repositoryModule,
      repositoryModule.exports
    );
  }
  const dependencies = {
    '@config/environment': {},
    '@config/database': {},
    '@appTypes': {},
    '@exceptions': {},
    '@services': {},
    '@repositories': {
      ConversationMemberRepository: { findMember: async () => ({}) },
      MessageRepository: repositories.Message,
      ConversationEventRepository: repositories.ConversationEvent,
    },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    (name) => (name.startsWith('node:') ? require(name) : dependencies[name]),
    module,
    module.exports
  );
  const service = module.exports.messageService;
  service.decipherMessage = (value) => value;
  return service;
}
const message = (id, createdAt) => ({ id, createdAt: new Date(createdAt), cipheredContent: id });
const event = (id, createdAt) => ({ id, type: 'CALL_ACCEPTED', createdAt: new Date(createdAt) });
test('mixed history returns the latest call before older messages and uses its last item as cursor', async () => {
  const service = fixture(
    [
      message('recent-message', '2026-11-12T22:37:23Z'),
      message('old-message', '2026-11-03T02:40:09Z'),
    ],
    [event('recent-call', '2026-11-14T21:18:28Z')]
  );
  const result = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
  });
  assert.deepEqual(
    result.page.map((item) => item.id),
    ['recent-call', 'recent-message']
  );
  assert.ok(result.nextCursor.endsWith('.recent-message'));
  assert.equal(result.page.length, 2);
});
test('the final descending page does not include a next cursor', async () => {
  const service = fixture(
    [message('message', '2026-11-12T22:37:23Z')],
    [event('call', '2026-11-14T21:18:28Z')]
  );
  const result = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
  });
  assert.deepEqual(
    result.page.map((item) => item.id),
    ['call', 'message']
  );
  assert.equal(result.nextCursor, null);
});

test('paginating with a message cursor excludes newer calls from the next page', async () => {
  const service = fixture(
    [
      message('recent-message', '2026-11-12T22:37:23Z'),
      message('old-message', '2026-11-03T02:40:09Z'),
    ],
    [event('today-call', '2026-11-14T21:18:28Z')]
  );
  const first = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
  });
  const second = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.deepEqual(
    first.page.map((item) => item.id),
    ['today-call', 'recent-message']
  );
  assert.deepEqual(
    second.page.map((item) => item.id),
    ['old-message']
  );
  assert.equal(second.nextCursor, null);
});

test('paginating with an event cursor excludes newer messages as well', async () => {
  const service = fixture(
    [
      message('recent-message', '2026-11-14T22:37:23Z'),
      message('old-message', '2026-11-03T02:40:09Z'),
    ],
    [event('call', '2026-11-12T21:18:28Z')]
  );
  const first = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
  });
  const second = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.ok(first.nextCursor.endsWith('.call'));
  assert.deepEqual(
    second.page.map((item) => item.id),
    ['old-message']
  );
  assert.equal(second.nextCursor, null);
});

test('chat pagination continues when the call event used as cursor was physically deleted', async () => {
  const deletedIds = [];
  const service = fixture(
    [
      message('recent-message', '2026-11-14T22:37:23Z'),
      message('old-message', '2026-11-03T02:40:09Z'),
    ],
    [event('call', '2026-11-12T21:18:28Z')],
    deletedIds
  );
  const first = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
  });
  deletedIds.push('call');
  const second = await service.getConversationMessages('user', {
    conversationId: 'conversation',
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.deepEqual(
    second.page.map((item) => item.id),
    ['old-message']
  );
  assert.equal(second.nextCursor, null);
});
