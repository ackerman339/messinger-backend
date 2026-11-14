import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(
  new URL('../../src/services/conversation.service.ts', import.meta.url),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText;
function fixture(history) {
  const conversation = { id: 'conversation', type: 'PRIVATE', members: [] };
  const dependencies = {
    '@config/database': {},
    '@appTypes': {},
    '@exceptions': {},
    '@events': {},
    '@repositories': {
      ConversationRepository: { getConversationList: async () => [conversation] },
    },
    '@services': {
      messageService: {
        getConversationMessages: async () => ({ page: history, nextCursor: 'older-history' }),
      },
    },
    '@utils': { paginate: ({ items }) => ({ page: items, nextCursor: null }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    (name) =>
      name.startsWith('node:') || name === 'date-fns' ? require(name) : dependencies[name],
    module,
    module.exports
  );
  return module.exports.conversationService;
}
const message = {
  id: 'message',
  type: 'MESSAGE',
  content: 'Hola',
  createdAt: new Date('2026-11-12T12:00:00Z'),
};
const event = {
  id: 'event',
  type: 'CALL_ACCEPTED',
  metadata: { media: 'video' },
  createdAt: new Date('2026-11-14T12:00:00Z'),
};
test('bootstrap lastMessage is the latest call event and retains its metadata', async () => {
  const result = await fixture([event, message]).getConversationBootstrap('user', { limit: 20 });
  assert.equal(result.page[0].lastMessage, event);
  assert.equal(result.page[0].lastMessage.metadata.media, 'video');
  assert.deepEqual(result.page[0].messages, [event, message]);
  assert.equal(result.page[0].messagesCursor, 'older-history');
});
test('bootstrap lastMessage is the latest text message when it follows an event', async () => {
  const latest = { ...message, createdAt: new Date('2026-11-14T13:00:00Z') };
  const result = await fixture([latest, event]).getConversationBootstrap('user', { limit: 20 });
  assert.equal(result.page[0].lastMessage, latest);
});
test('an empty conversation has no lastMessage', async () => {
  const result = await fixture([]).getConversationBootstrap('user', { limit: 20 });
  assert.equal(result.page[0].lastMessage, undefined);
});
