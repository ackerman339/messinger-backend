import assert from 'node:assert/strict';
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

const status = { SENT: 'SENT', DELIVERED: 'DELIVERED', READ: 'READ' };
const events = load('constants/websocket', {});

test('offline replay sends attachments to the reconnecting socket and waits for a real receipt', async () => {
  const sent = [];
  const date = new Date('2026-01-01');
  const pending = (member) => ({
    message: {
      conversation: { members: [member] },
      createdAt: date,
      attachments: [{ id: 'attachment' }],
      cipheredContent: 'encrypted',
    },
  });
  const { offlineSyncService } = load('services/offline-sync.service', {
    typeorm: {},
    '@appTypes': { MessageStatus: status },
    '@constants': events,
    '@websocket/send-message': {
      sendMessage: (connection, event) => sent.push({ connection, event }),
    },
    '@services': {
      messageService: {
        decodeContent: () => ({ content: 'Hola' }),
        serializeMessage: ({ content, attachments }) => ({ content, attachments }),
      },
    },
    '@repositories': {
      MessageDeliveryRepository: {
        async find({ where }) {
          assert.deepEqual(where, { userId: 'recipient', status: 'SENT' });
          return [
            pending({ userId: 'recipient' }),
            pending({ userId: 'recipient', emptyMessagesAt: date }),
          ];
        },
      },
    },
  });
  const connection = { id: 'new-device' };
  await offlineSyncService.syncPendingMessages('recipient', connection);
  assert.deepEqual(sent, [
    {
      connection,
      event: {
        type: 'NEW_MESSAGE',
        data: { content: 'Hola', attachments: [{ id: 'attachment' }] },
      },
    },
  ]);
});

test('the receipt handler rejects an inconsistent transition and confirms a duplicate without rebroadcasting', async () => {
  const schema = load('dtos/websocket/message-delivery.dto', {
    zod,
    '@appTypes': { MessageStatus: status },
  });
  const sent = [];
  let calls = 0;
  const sender = { id: 'sender-device' };
  const recipient = { id: 'recipient-device', userId: 'recipient' };
  const { messageDeliveryHandler } = load('websocket/handlers/message-delivery', {
    '@appTypes': { MessageStatus: status },
    '@constants': events,
    '@dtos': schema,
    '@exceptions': { BadRequestException: Error },
    '@services': {
      messageService: {
        async confirmDelivery(userId) {
          assert.equal(userId, recipient.userId);
          return { changed: ++calls === 1, delivery: { userId, message: { senderId: 'sender' } } };
        },
      },
    },
    '../authenticate-guard': { requireAuthentication() {} },
    '../managers/connection-manager': { connectionManager: { getUserConnections: () => [sender] } },
    '../send-message': {
      sendMessage: (connection, event) => sent.push([connection.id, event.type, event.requestId]),
    },
  });
  const data = {
    conversationId: crypto.randomUUID(),
    messageId: crypto.randomUUID(),
    status: 'READ',
  };
  const receive = (type, payload = data) =>
    messageDeliveryHandler({
      connection: recipient,
      message: { type, data: payload, requestId: 'receipt' },
    });
  await assert.rejects(receive('MESSAGE_DELIVERED'), /INVALID_RECEIPT_EVENT/);
  await assert.rejects(receive('MESSAGE_READ', { ...data, status: 'SENT' }));
  await receive('MESSAGE_READ');
  await receive('MESSAGE_READ');
  assert.deepEqual(sent, [
    ['sender-device', 'MESSAGE_STATUS_UPDATED', undefined],
    ['recipient-device', 'MESSAGE_RECEIPT_CONFIRMED', 'receipt'],
    ['recipient-device', 'MESSAGE_RECEIPT_CONFIRMED', 'receipt'],
  ]);
});
