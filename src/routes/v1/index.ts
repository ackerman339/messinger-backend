import { Router } from 'express';
import { UserRole } from '@appTypes';
import { validateDTO, authenticate, authorize } from '@middlewares';

import {
  signUpSchema,
  signInSchema,
  CreateGroupSchema,
  LeaveGroupSchema,
  TransferOwnershipSchema,
  DeleteConversationSchema,
  GetConversationMessagesSchema,
  RemoveMemberSchema,
  UploadSchema,
  DownloadSchema,
  GetUserByCodeSchema,
  AdminSchema,
  UserSchema,
  ListUserMessagesSchema,
  ListUsersSchema,
  ListConversationsSchema,
  WebPushSubscriptionSchema,
  WebPushUnsubscriptionSchema,
  DeleteMessagesSchema,
  ResetUnreadMessagesCountSchema,
} from '@dtos';

import {
  signup,
  signin,
  logout,
  mobileSignin,
  createGroup,
  leaveGroup,
  transferGroupOwnership,
  deleteGroup,
  deletePrivateConversation,
  getConversationsBootstrap,
  getConversationMessages,
  removeGroupMember,
  getMe,
  processUpload,
  downloadAttachment,
  getUserByCode,
  createAdmin,
  adminSignIn,
  restoreUserLoginKey,
  deleteUser,
  deleteAmin,
  listUsers,
  listUserConversations,
  listConversationMessages,
  listAdmins,
  subscribeWeb,
  unsubscribeWeb,
  deleteMessages,
  resetUnreadMessagesCount,
} from '@controllers';

const router = Router();

// Authentication and authorization endpoints
router.post('/sign-in', validateDTO(signInSchema), signin);
router.post('/mobile/sign-in', validateDTO(signInSchema), mobileSignin);
router.post('/sign-up', validateDTO(signUpSchema), signup);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/refresh', authenticate, (_req, res) => {
  res.sendStatus(204);
});

// Files uploads
router.post(
  '/upload',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(UploadSchema),
  processUpload
);

router.get(
  '/download',
  authenticate,
  authorize(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateDTO(DownloadSchema),
  downloadAttachment
);

// User endpoints
router.get(
  '/user-code',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(GetUserByCodeSchema),
  getUserByCode
);

// Conversation endpoints
router.get(
  '/conversation-list',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(ListConversationsSchema),
  getConversationsBootstrap
);

router.post(
  '/conversation/leave-group',
  authorize(UserRole.USER),
  authenticate,
  validateDTO(LeaveGroupSchema),
  leaveGroup
);
router.get(
  '/conversation/messages',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(GetConversationMessagesSchema),
  getConversationMessages
);

router.post(
  '/conversation/create-group',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(CreateGroupSchema),
  createGroup
);

router.post(
  '/conversation/transfer-ownership',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(TransferOwnershipSchema),
  transferGroupOwnership
);

router.post(
  '/conversation/remove-group-member',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(RemoveMemberSchema),
  removeGroupMember
);

router.delete(
  '/conversation/delete-group',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(DeleteConversationSchema),
  deleteGroup
);

router.delete(
  '/conversation/delete-private',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(DeleteConversationSchema),
  deletePrivateConversation
);

router.delete(
  '/conversation/delete-messages',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(DeleteMessagesSchema),
  deleteMessages
);

router.patch(
  '/conversation/reset-unread-messages-count',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(ResetUnreadMessagesCountSchema),
  resetUnreadMessagesCount
);

// Admin and super admin endpoints
router.post('/admin/sign-in', validateDTO(AdminSchema), adminSignIn);

router.post(
  '/admin/create-admin',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateDTO(AdminSchema),
  createAdmin
);

router.patch(
  '/admin/restore-login-key',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateDTO(UserSchema),
  restoreUserLoginKey
);

router.delete(
  '/admin/delete-user',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateDTO(UserSchema),
  deleteUser
);

router.delete(
  '/admin/delete-admin',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateDTO(UserSchema),
  deleteAmin
);

router.get(
  '/admin/list-admins',
  authenticate,
  validateDTO(ListUsersSchema),
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  listAdmins
);

router.get(
  '/admin/list-users',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateDTO(ListUsersSchema),
  listUsers
);

router.get(
  '/admin/list-user-conversations',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateDTO(ListConversationsSchema),
  listUserConversations
);

router.get(
  '/admin/list-conversation-messages',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateDTO(ListUserMessagesSchema),
  listConversationMessages
);

// Push subscription
router.post(
  '/push/subscribe-web',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(WebPushSubscriptionSchema),
  subscribeWeb
);

// Push subscription
router.delete(
  '/push/unsubscribe-web',
  authenticate,
  authorize(UserRole.USER),
  validateDTO(WebPushUnsubscriptionSchema),
  unsubscribeWeb
);

export default router;
