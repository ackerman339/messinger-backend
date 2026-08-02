import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { env } from '@config/environment';
import { AppDataSource } from '@config/database';
import { MessageStatus, ConversationType } from '@appTypes';
import { NotFoundException, ForbiddenException } from '@exceptions';
import { conversationService } from '@services';
import {
  PrivateMessageDto,
  GroupMessageDto,
  MessageDeliveryDto,
  GetConversationMessagesDto,
} from '@dtos';
import {
  ConversationRepository,
  ConversationMemberRepository,
  MessageDeliveryRepository,
  MessageRepository,
  ConversationEventRepository,
} from '@repositories';

class MessageService {
  private cipherMessage(content: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', env.MESSAGE_ENCRYPTION_KEY, iv);

    const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return {
      cipheredContent: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  decipherMessage(encryptedContent: string, iv: string, authTag: string) {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      env.MESSAGE_ENCRYPTION_KEY,
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedContent, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  async createPrivateMessage(senderId: string, { receiverId, content }: PrivateMessageDto) {
    const { cipheredContent, iv, authTag } = this.cipherMessage(content);
    const conversation = await conversationService.getOrCreatePrivateConversation({
      type: ConversationType.PRIVATE,
      creatorId: senderId,
      members: [receiverId],
    });

    const [sender, receiver, members] = await Promise.all([
      ConversationMemberRepository.findMember(conversation.id, senderId),
      ConversationMemberRepository.findMember(conversation.id, receiverId),
      ConversationRepository.getConversationMembers(conversation.id),
    ]);

    const result = await AppDataSource.transaction(async (manager) => {
      if (sender?.softDeletedAt) {
        await ConversationMemberRepository.restoreConversation(conversation.id, senderId, manager);
      }

      if (receiver?.softDeletedAt) {
        await ConversationMemberRepository.restoreConversation(
          conversation.id,
          receiverId,
          manager
        );
      }

      const newMessage = MessageRepository.create({
        conversationId: conversation.id,
        senderId,
        cipheredContent,
        iv,
        authTag,
      });

      const savedMessage = await MessageRepository.saveMessage(newMessage, manager);
      const { id, conversationId, createdAt } = savedMessage;

      const deliveries = members
        .filter((member) => member.userId !== senderId)
        .map((member) => ({
          messageId: savedMessage.id,
          userId: member.userId,
          status: MessageStatus.SENT,
        }));

      await MessageDeliveryRepository.createDeliveries(deliveries, manager);
      await ConversationRepository.updateLastMessage(conversation.id, savedMessage.id, manager);

      await Promise.all(
        members
          .filter((member) => member.userId !== senderId)
          .map((member) =>
            ConversationMemberRepository.incrementUnreadCount(
              conversation.id,
              member.userId,
              manager
            )
          )
      );

      return { id, senderId, conversationId, createdAt, content };
    });

    return {
      members,
      savedMessage: result,
    };
  }

  async createGroupMessage(senderId: string, { conversationId, content }: GroupMessageDto) {
    const [conversation, member, members] = await Promise.all([
      ConversationRepository.findById(conversationId),
      ConversationMemberRepository.findMember(conversationId, senderId),
      ConversationMemberRepository.getMembers(conversationId),
    ]);

    if (!conversation) {
      throw new NotFoundException('GROUP:NOT_FOUND');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ForbiddenException('GROUP:INVALID_CONVERSATION_TYPE');
    }

    if (!member) {
      throw new ForbiddenException('GROUP:USER_NOT_MEMBER');
    }

    if (member.softDeletedAt) {
      throw new ForbiddenException('GROUP:USER_LEFT_GROUP');
    }

    const { cipheredContent, iv, authTag } = this.cipherMessage(content);

    return AppDataSource.transaction(async (manager) => {
      const message = MessageRepository.create({
        conversationId,
        senderId,
        cipheredContent,
        iv,
        authTag,
      });

      const savedMessage = await MessageRepository.saveMessage(message, manager);
      const { id, createdAt } = savedMessage;

      const deliveries = members
        .filter((member) => member.userId !== senderId)
        .map((member) => ({
          messageId: savedMessage.id,
          userId: member.userId,
          status: MessageStatus.SENT,
        }));

      await MessageDeliveryRepository.createDeliveries(deliveries, manager);
      await ConversationRepository.updateLastMessage(conversation.id, savedMessage.id, manager);

      await Promise.all(
        members
          .filter((member) => member.userId !== senderId)
          .map((member) =>
            ConversationMemberRepository.incrementUnreadCount(
              conversation.id,
              member.userId,
              manager
            )
          )
      );

      return {
        savedMessage: { id, createdAt, senderId, conversationId, content },
        members,
      };
    });
  }

  async getConversationMessages(
    userId: string,
    { conversationId, limit, cursor }: GetConversationMessagesDto
  ) {
    const member = await ConversationMemberRepository.findMember(conversationId, userId);

    const [messages, events] = await Promise.all([
      MessageRepository.findByConversation({
        conversationId,
        limit,
        cursor,
        lastDeletedAt: member?.softDeletedAt,
      }),
      ConversationEventRepository.findByConversation({ conversationId, limit, cursor }),
    ]);

    const history = [
      ...messages.map((message) => {
        const { cipheredContent, iv, authTag, ...rest } = message;
        const content = this.decipherMessage(cipheredContent, iv, authTag);
        return {
          ...rest,
          content,
          type: 'MESSAGE',
        };
      }),
      ...events,
    ];

    history.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const page = history.slice(0, limit + 1);
    const hasMore = page.length > limit;
    const items = page.slice(0, limit);
    const firstItem = items.at(0);
    const nextCursor = hasMore ? firstItem?.id : null;

    return {
      items,
      nextCursor,
    };
  }

  async confirmDelivery(userId: string, { conversationId, messageId, status }: MessageDeliveryDto) {
    const delivery = await MessageDeliveryRepository.findByMessageAndUser(messageId, userId);

    if (!delivery) {
      throw new NotFoundException('COMFIRM_DELIVERY:DELIVERY_NOT_FOUND');
    }

    if (status === MessageStatus.READ) {
      await ConversationMemberRepository.resetUnreadCount(conversationId, userId);
    }

    await MessageDeliveryRepository.updateDeliveryStatus(delivery.id, {
      status,
      ...(status === MessageStatus.DELIVERED
        ? { deliveredAt: new Date() }
        : { readAt: new Date() }),
    });

    return delivery;
  }
}

export const messageService = new MessageService();
