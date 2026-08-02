import { Request, Response } from 'express';
import { conversationService, messageService } from '@services';
import {
  CreateGroupDto,
  LeaveGroupDto,
  TransferOwnershipDto,
  RemoveMemberDto,
  DeleteConversationDto,
  GetConversationMessagesDto,
} from '@dtos';

export async function getConversationsList(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  const conversations = await conversationService.getConversationsList(userId);

  res.status(200).json({
    message: 'Conversations loaded',
    result: conversations,
  });
}

export async function getConversationMessages(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as GetConversationMessagesDto;
  const userId = res.locals.userId!;
  const { items, nextCursor } = await messageService.getConversationMessages(userId, dto);

  res.status(200).json({
    message: 'Conversations loaded',
    result: {
      items,
      nextCursor,
    },
  });
}

export async function createGroup(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as CreateGroupDto;
  const userId = res.locals.userId!;
  const group = await conversationService.createGroup(userId, dto);

  res.status(201).json({
    message: 'Group created successfully',
    result: {
      id: group.id,
      name: group.name,
    },
  });
}

export async function leaveGroup(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as LeaveGroupDto;
  const userId = res.locals.userId!;
  await conversationService.leaveGroup(userId, dto.conversationId);

  res.sendStatus(204);
}

export async function transferGroupOwnership(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as TransferOwnershipDto;
  const userId = res.locals.userId!;
  await conversationService.transferGroupOwnership(userId, dto);

  res.sendStatus(204);
}

export async function removeGroupMember(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as RemoveMemberDto;
  const userId = res.locals.userId!;
  await conversationService.removeGroupMember(userId, dto);

  res.sendStatus(204);
}

export async function deleteGroup(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as DeleteConversationDto;
  const userId = res.locals.userId!;
  await conversationService.deleteGroup(userId, dto);

  res.sendStatus(204);
}

export async function deletePrivateConversation(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as DeleteConversationDto;
  const userId = res.locals.userId!;
  await conversationService.deletePrivateConversation(userId, dto.conversationId);

  res.sendStatus(204);
}
