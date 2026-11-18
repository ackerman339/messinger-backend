import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { URL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const source = fs.readFileSync(new URL(`../../src/${file}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(
    (name) =>
      dependencies[name] ?? (name.startsWith('node:') || name === 'date-fns' ? require(name) : {}),
    module,
    module.exports
  );
  return module.exports;
}
const types = {
  ConversationType: { GROUP: 'GROUP' },
  ConversationRole: { OWNER: 'OWNER', MEMBER: 'MEMBER' },
  ConversationEventType: { MEMBER_JOINED: 'MEMBER_JOINED', MEMBER_INVITED: 'MEMBER_INVITED' },
  GroupInvitationStatus: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    EXPIRED: 'EXPIRED',
  },
};
const exceptions = { ForbiddenException: Error, NotFoundException: Error };
function fixture({
  member = null,
  status = 'PENDING',
  expired = false,
  actorRemoved = false,
} = {}) {
  const invitation = {
    id: 'invite',
    conversationId: 'group',
    targetId: 'user',
    status,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + (expired ? -10000 : 100000)),
  };
  const events = [],
    notifications = [];
  const actor = { userId: 'owner', role: 'OWNER', softDeletedAt: actorRemoved ? new Date() : null };
  let target = member;
  const invitationRepository = {
    async findOne({ where }) {
      return invitation.status === where.status ? invitation : null;
    },
    async update(where, values) {
      if (invitation.status === where.status) Object.assign(invitation, values);
    },
  };
  const manager = {
    getRepository(entity) {
      if (entity === 'Conversation')
        return { findOne: async () => ({ id: 'group', type: 'GROUP', name: 'Test' }) };
      if (entity === 'GroupInvitation') return invitationRepository;
      if (entity === 'ConversationMember')
        return { findOne: async ({ where }) => (where.userId === 'owner' ? actor : target) };
      throw Error(entity);
    },
  };
  const dependencies = {
    '@config/database': { AppDataSource: { transaction: async (fn) => fn(manager) } },
    '@appTypes': types,
    '@exceptions': exceptions,
    '@entities': {
      Conversation: 'Conversation',
      ConversationMember: 'ConversationMember',
      GroupInvitation: 'GroupInvitation',
    },
    '@events': { groupEvents: { emit: (...args) => notifications.push(args) } },
    '@repositories': {
      ConversationRepository: {
        create: (data) => data,
        saveConversation: async (data) => ({ id: 'group', ...data }),
      },
      ConversationMemberRepository: {
        restoreConversation: async () => {
          target.softDeletedAt = null;
        },
        bulkCreate: async ([data]) => {
          target = { ...data, softDeletedAt: null };
        },
        getMembers: async () => [actor, target].filter(Boolean),
      },
      ConversationEventRepository: { createEvent: async (event) => events.push(event) },
      GroupInvitationRepository: {
        createInvitation: async (data) => ({ id: 'new-invite', ...data }),
      },
    },
  };
  const service = load('services/conversation.service', dependencies).conversationService;
  return { service, invitation, events, notifications };
}
test('acceptance adds an active member and consumes the invitation', async () => {
  const f = fixture();
  const result = await f.service.acceptGroupInvitation('group', 'user');
  assert.equal(f.invitation.status, 'ACCEPTED');
  assert.equal(result.members.length, 2);
  assert.equal(f.events[0].type, 'MEMBER_JOINED');
  await assert.rejects(f.service.acceptGroupInvitation('group', 'user'), /NOT_FOUND/);
});
test('acceptance restores removed members and records their rejoin', async () => {
  const f = fixture({ member: { userId: 'user', softDeletedAt: new Date() } });
  const result = await f.service.acceptGroupInvitation('group', 'user');
  assert.equal(result.members[1].softDeletedAt, null);
  assert.equal(f.invitation.status, 'ACCEPTED');
  assert.equal(f.events[0].type, 'MEMBER_JOINED');
});
for (const method of ['acceptGroupInvitation', 'rejectGroupInvitation']) {
  test(`${method} expires stale invitations`, async () => {
    const f = fixture({ expired: true });
    await assert.rejects(f.service[method]('group', 'user'), /EXPIRED/);
    assert.equal(f.invitation.status, 'EXPIRED');
  });
  test(`${method} cannot reuse rejected invitations`, async () => {
    const f = fixture({ status: 'REJECTED' });
    await assert.rejects(f.service[method]('group', 'user'), /NOT_FOUND/);
  });
}
test('rejection consumes the invitation without adding members', async () => {
  const f = fixture();
  await f.service.rejectGroupInvitation('group', 'user');
  assert.equal(f.invitation.status, 'REJECTED');
  assert.equal(f.events.length, 0);
});
test('repeated invitations reuse the existing pending invitation', async () => {
  const f = fixture();
  const result = await f.service.validateGroupInvitation('owner', {
    conversationId: 'group',
    targetUserId: 'user',
  });
  assert.equal(result.invitationId, 'invite');
});
test('removed owners cannot invite members', async () => {
  const f = fixture({ actorRemoved: true });
  await assert.rejects(
    f.service.validateGroupInvitation('owner', { conversationId: 'group', targetUserId: 'user' }),
    /USER_IS_NOT_MEMBER/
  );
});
test('group creation invites unique initial members and skips the owner', async () => {
  const f = fixture();
  await f.service.createGroup('owner', { name: 'Test', members: ['user', 'user', 'owner'] });
  assert.equal(f.notifications.length, 1);
  assert.equal(f.notifications[0][1].targetUserId, 'user');
});
for (const member of [null, { softDeletedAt: new Date() }]) {
  test(`history rejects ${member ? 'removed' : 'missing'} membership before reading messages`, async () => {
    const service = load('services/message.service', {
      '@exceptions': exceptions,
      '@repositories': { ConversationMemberRepository: { findMember: async () => member } },
    }).messageService;
    await assert.rejects(
      service.getConversationMessages('user', { conversationId: 'group', limit: 20 }),
      /USER_NOT_MEMBER/
    );
  });
}
test('group deletion notifies each member by user ID', () => {
  const listeners = {},
    sent = [];
  load('events/group-listeners', {
    '@appTypes': { ConversationEventType: { GROUP_DELETED: 'GROUP_DELETED' } },
    '@constants': { WS_SERVER_EVENTS: { GROUP_DELETED: 'GROUP_DELETED' } },
    './group-events': {
      groupEvents: {
        on: (type, fn) => {
          listeners[type] = fn;
        },
      },
    },
    '@websocket/managers/connection-manager': {
      connectionManager: {
        getUserConnections: (id) => {
          assert.equal(typeof id, 'string');
          return [id];
        },
      },
    },
    '@websocket/send-message': { sendMessage: (connection) => sent.push(connection) },
  }).registerGroupListeners();
  listeners.GROUP_DELETED({
    conversationId: 'group',
    members: [{ userId: 'one' }, { userId: 'two' }],
  });
  assert.deepEqual(sent, ['one', 'two']);
});
function dispatcherFixture() {
  const sent = [],
    errors = [];
  const dependencies = {
    '@constants': {
      WS_CLIENT_EVENTS: {
        GROUP_INVITE_MEMBER: 'GROUP_INVITE_MEMBER',
        GROUP_INVITATION_ACCEPT: 'GROUP_INVITATION_ACCEPT',
        GROUP_INVITATION_REJECT: 'GROUP_INVITATION_REJECT',
      },
      WS_SERVER_EVENTS: { GROUP_ACTION_CONFIRMED: 'GROUP_ACTION_CONFIRMED' },
    },
    '@exceptions': { ValidationException: Error },
    './send-message': { sendMessage: (_connection, message) => sent.push(message) },
    './send-error': {
      sendError: (_connection, error, requestId) => errors.push({ error, requestId }),
    },
    zod: require('zod'),
  };
  return { ...load('websocket/dispatcher', dependencies).createEventDispatcher(), sent, errors };
}
for (const event of ['GROUP_INVITE_MEMBER', 'GROUP_INVITATION_ACCEPT', 'GROUP_INVITATION_REJECT']) {
  test(`${event} confirms its request ID only after persistence succeeds`, async () => {
    const f = dispatcherFixture();
    let persisted = false;
    f.register(event, async () => {
      persisted = true;
    });
    await f.dispatch({}, { type: event, data: {}, requestId: 'request' });
    assert.equal(persisted, true);
    assert.deepEqual(f.sent, [
      { type: 'GROUP_ACTION_CONFIRMED', requestId: 'request', data: { event } },
    ]);
  });
}
test('failed group commands return their request ID and no success confirmation', async () => {
  const f = dispatcherFixture();
  f.register('GROUP_INVITATION_ACCEPT', async () => {
    throw new Error('expired');
  });
  await f.dispatch({}, { type: 'GROUP_INVITATION_ACCEPT', data: {}, requestId: 'failed-request' });
  assert.deepEqual(f.sent, []);
  assert.equal(f.errors[0].requestId, 'failed-request');
});
test('legacy clients without request IDs keep receiving the existing group events', async () => {
  const f = dispatcherFixture();
  f.register('GROUP_INVITE_MEMBER', async () => {});
  await f.dispatch({}, { type: 'GROUP_INVITE_MEMBER', data: {} });
  assert.deepEqual(f.sent, []);
});
