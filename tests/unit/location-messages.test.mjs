import assert from 'node:assert/strict';
import * as cryptoModule from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as zod from 'zod';

function load(file, dependencies) {
  const input = readFileSync(new URL(`../../src/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    (name) => dependencies[name],
    module,
    module.exports
  );
  return module.exports;
}

test('private and group message schemas validate structured locations and preserve text messages', () => {
  const locationDtos = load('dtos/websocket/location.dto', { zod });
  const { PrivateMessageSchema, GroupMessageSchema } = load('dtos/websocket/message.dto', {
    zod,
    './location.dto': locationDtos,
  });
  const now = Date.now();
  const location = { latitude: 4.6, longitude: -74.1, capturedAt: now, expiresAt: now + 900_000 };
  const payload = {
    content: 'Ubicación',
    receiverId: crypto.randomUUID(),
    conversationId: crypto.randomUUID(),
  };

  for (const schema of [PrivateMessageSchema, GroupMessageSchema]) {
    assert.equal(schema.safeParse(payload).success, true);
    assert.equal(schema.safeParse({ ...payload, location }).success, true);
    assert.equal(
      schema.safeParse({ ...payload, location: { ...location, latitude: 91 } }).success,
      false
    );
    assert.equal(
      schema.safeParse({ ...payload, location: { ...location, longitude: Infinity } }).success,
      false
    );
    assert.equal(
      schema.safeParse({ ...payload, location: { ...location, expiresAt: now + 9 * 3600000 } })
        .success,
      false
    );
  }
});

test('live locations are encrypted, can only be changed by the sender, and stop permanently', async () => {
  const sender = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const timestamp = Date.now();
  let row;
  const messageEntity = {};
  const memberEntity = {};
  const query = {
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    async getMany() {
      return [{ userId: sender }, { userId: 'recipient' }];
    },
  };
  const repository = {
    async findOne({ where, lock }) {
      assert.equal(lock.mode, 'pessimistic_write');
      if (
        where.id !== row.id ||
        where.senderId !== row.senderId ||
        where.isLocation !== row.isLocation
      )
        return null;
      return { ...row };
    },
    async update(id, changes) {
      assert.equal(id, messageId);
      row = { ...row, ...changes };
    },
  };
  const manager = {
    getRepository(entity) {
      return entity === messageEntity ? repository : { createQueryBuilder: () => query };
    },
  };
  const { messageService } = load('services/message.service', {
    'node:crypto': cryptoModule,
    '@entities': { Message: messageEntity, ConversationMember: memberEntity },
    '@config/environment': { env: { MESSAGE_ENCRYPTION_KEY: Buffer.alloc(32) } },
    '@config/database': { AppDataSource: { transaction: async (run) => run(manager) } },
    '@exceptions': { ForbiddenException: Error, NotFoundException: Error },
    '@services': {},
    '@repositories': { ConversationMemberRepository: { findMember: async () => ({}) } },
  });
  const initial = { latitude: 4.6, longitude: -74, capturedAt: timestamp - 2000 };
  row = {
    id: messageId,
    senderId: sender,
    conversationId: crypto.randomUUID(),
    createdAt: new Date(),
    ...messageService.encodeContent('Ubicación', { ...initial, expiresAt: timestamp + 900000 }),
  };
  assert.equal(row.cipheredContent.includes('-74'), false);
  assert.equal(messageService.decodeContent(row).location.latitude, 4.6);
  await assert.rejects(
    messageService.updateLiveLocation('recipient', messageId, initial),
    /LOCATION:NOT_FOUND/
  );

  const newest = { ...initial, latitude: 4.61, capturedAt: timestamp };
  const updated = await messageService.updateLiveLocation(sender, messageId, newest);
  assert.equal(updated.data.location.latitude, 4.61);
  assert.deepEqual(updated.memberIds, [sender, 'recipient']);
  assert.equal(await messageService.updateLiveLocation(sender, messageId, initial), null);
  assert.ok((await messageService.updateLiveLocation(sender, messageId)).data.location.stoppedAt);
  await assert.rejects(
    messageService.updateLiveLocation(sender, messageId, newest),
    /LOCATION:ENDED/
  );
});
