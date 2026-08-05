import { Router } from 'express';
import { validateDTO, authenticate } from '@middlewares';

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
} from '@dtos';

import {
  signup,
  signin,
  logout,
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
} from '@controllers';

const router = Router();

// Authentication and authorization endpoints
router.post('/sign-in', validateDTO(signInSchema), signin);
router.post('/sign-up', validateDTO(signUpSchema), signup);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/refresh', authenticate, (_req, res) => {
  res.sendStatus(204);
});

// Files uploads
router.post('/upload', authenticate, validateDTO(UploadSchema), processUpload);
router.get('/download', authenticate, validateDTO(DownloadSchema), downloadAttachment);

// User endpoints
router.get('/user-code', authenticate, validateDTO(GetUserByCodeSchema), getUserByCode);

// Conversation endpoints
router.get('/conversation-list', authenticate, getConversationsBootstrap);
router.post('/conversation/leave-group', authenticate, validateDTO(LeaveGroupSchema), leaveGroup);
router.get(
  '/conversation/messages',
  authenticate,
  validateDTO(GetConversationMessagesSchema),
  getConversationMessages
);

router.post(
  '/conversation/create-group',
  authenticate,
  validateDTO(CreateGroupSchema),
  createGroup
);

router.post(
  '/conversation/transfer-ownership',
  authenticate,
  validateDTO(TransferOwnershipSchema),
  transferGroupOwnership
);

router.post(
  '/conversation/remove-group-member',
  authenticate,
  validateDTO(RemoveMemberSchema),
  removeGroupMember
);

router.delete(
  '/conversation/delete-group',
  authenticate,
  validateDTO(DeleteConversationSchema),
  deleteGroup
);

router.delete(
  '/conversation/delete-private',
  authenticate,
  validateDTO(DeleteConversationSchema),
  deletePrivateConversation
);

export default router;
