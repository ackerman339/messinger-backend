import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(
  new URL('../../src/repositories/conversation-member.repository.ts', import.meta.url),
  'utf8'
);
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
}).outputText;

test('empty chat persists a per-member cutoff and resets that members unread count', async () => {
  let changed;
  const repository = {
    extend(methods) {
      return Object.assign(this, methods);
    },
    update: async (where, fields) => {
      changed = { where, fields };
    },
  };
  const dependencies = {
    typeorm: {},
    '@appTypes': {},
    '@entities': { ConversationMember: 'ConversationMember' },
    '@config/database': { AppDataSource: { getRepository: () => repository } },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => dependencies[name],
    module,
    module.exports
  );
  await module.exports.ConversationMemberRepository.emptyMessages('chat', 'alice');
  assert.deepEqual(changed.where, { conversationId: 'chat', userId: 'alice' });
  assert.ok(changed.fields.emptyMessagesAt instanceof Date);
  assert.equal(changed.fields.unreadCount, 0);
});
