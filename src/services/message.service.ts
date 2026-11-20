import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { ConversationMember, Message } from '@entities';
import { env } from '@config/environment';
import { AppDataSource } from '@config/database';
import { MessageStatus, ConversationType } from '@appTypes';
import { NotFoundException, ForbiddenException } from '@exceptions';
import { conversationService, storageService } from '@services';

import {
  PrivateMessageDto,
  GroupMessageDto,
  MessageDeliveryDto,
  GetConversationMessagesDto,
  DeleteMessagesDto,
  LocationInput,
  LocationPoint,
  LocationState,
} from '@dtos';

import {
  ConversationRepository,
  ConversationMemberRepository,
  MessageDeliveryRepository,
  MessageRepository,
  ConversationEventRepository,
  MessageAttachmentRepository,
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

  decodeContent(
    message: Pick<Message, 'cipheredContent' | 'iv' | 'authTag'> &
      Partial<Pick<Message, 'isLocation' | 'locationExpiresAt' | 'locationStoppedAt'>>
  ): { content: string; location?: LocationState } {
    const decoded = this.decipherMessage(message.cipheredContent, message.iv, message.authTag);
    if (!message.isLocation) return { content: decoded };
    const point = JSON.parse(decoded) as LocationPoint;
    return {
      content: message.locationExpiresAt ? 'Ubicación en tiempo real' : 'Ubicación compartida',
      location: {
        ...point,
        ...(message.locationExpiresAt ? { expiresAt: message.locationExpiresAt.getTime() } : {}),
        ...(message.locationStoppedAt ? { stoppedAt: message.locationStoppedAt.getTime() } : {}),
      },
    };
  }

  private encodeContent(content: string, location?: LocationInput) {
    if (!location) return this.cipherMessage(content);
    const { expiresAt, ...point } = location;
    return {
      ...this.cipherMessage(JSON.stringify(point)),
      isLocation: true,
      locationExpiresAt: expiresAt ? new Date(expiresAt) : null,
    };
  }

  private async findReplay(manager: EntityManager, senderId: string, clientMessageId?: string) {
    if (!clientMessageId) return null;
    // Serialize retries across sockets and server instances before any message side effects.
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${senderId}:${clientMessageId.toLowerCase()}`,
    ]);
    return manager.getRepository(Message).findOne({
      where: { senderId, clientMessageId },
      relations: { attachments: true, deliveries: true, conversation: { members: { user: true } } },
    });
  }

  serializeMessage(
    message: Pick<Message, 'id' | 'createdAt' | 'senderId' | 'conversationId' | 'attachments'> & {
      content: string;
      location?: LocationState;
    },
    conversation?: Message['conversation']
  ) {
    const { id, createdAt, senderId, conversationId, content, attachments } = message;
    const data = {
      id,
      messageId: id,
      senderId,
      conversationId,
      createdAt,
      content,
      ...(message.location ? { location: message.location } : {}),
      attachments,
      type: 'MESSAGE' as const,
    };
    if (conversation?.type !== ConversationType.PRIVATE) return data;

    return {
      ...data,
      conversation: {
        id: conversation.id,
        name: conversation.name,
        type: conversation.type,
        createdAt: conversation.createdAt,
        updatedAt: createdAt,
        messages: [data],
        messagesCursor: null,
        lastMessage: data,
        members: conversation.members.map(({ user, userId, unreadCount, role, softDeletedAt }) => ({
          userId,
          username: user.username,
          lastSeenAt: user.lastSeenAt,
          unreadCount,
          role,
          softDeletedAt,
        })),
      },
    };
  }

  async createPrivateMessage(
    senderId: string,
    { receiverId, content, attachments, clientMessageId, location }: PrivateMessageDto
  ) {
    return AppDataSource.transaction(async (manager) => {
      const replay = await this.findReplay(manager, senderId, clientMessageId);
      if (replay) {
        if (
          replay.conversation.type !== ConversationType.PRIVATE ||
          !replay.conversation.members.some((member) => member.userId === receiverId) ||
          (receiverId === senderId && replay.conversation.members.length !== 1)
        ) {
          throw new ForbiddenException('MESSAGE:CLIENT_ID_ALREADY_USED');
        }
        return {
          members: replay.conversation.members,
          replayed: true,
          savedMessage: {
            ...replay,
            ...this.decodeContent(replay),
            senderName: undefined,
          },
        };
      }
      const encoded = this.encodeContent(content, location);
      const conversation = await conversationService.getOrCreatePrivateConversation(
        {
          type: ConversationType.PRIVATE,
          creatorId: senderId,
          members: [receiverId],
        },
        manager
      );
      if (!conversation) throw new NotFoundException('CONVERSATION_NOT_FOUND');
      const members = conversation.members;
      const sender = members.find((member) => member.userId === senderId);
      const receiver = members.find((member) => member.userId === receiverId);

      if (sender?.softDeletedAt) {
        await ConversationMemberRepository.restoreConversation(conversation.id, senderId, manager);
        sender.softDeletedAt = null;
      }

      if (receiver?.softDeletedAt) {
        await ConversationMemberRepository.restoreConversation(
          conversation.id,
          receiverId,
          manager
        );
        receiver.softDeletedAt = null;
      }

      const newMessage = MessageRepository.create({
        conversationId: conversation.id,
        senderId,
        clientMessageId,
        ...encoded,
      });

      const savedMessage = await MessageRepository.saveMessage(newMessage, manager);
      const { id, createdAt } = savedMessage;

      const deliveries = members
        .filter((member) => member.userId !== senderId)
        .map((member) => ({
          messageId: savedMessage.id,
          userId: member.userId,
          status: MessageStatus.SENT,
        }));

      await Promise.all([
        MessageDeliveryRepository.createDeliveries(deliveries, manager),

        ConversationRepository.updateLastMessage(conversation.id, savedMessage.id, manager),

        storageService.processMessageAttachments({
          userId: senderId,
          messageId: id,
          attachments,
          manager,
        }),

        ...members
          .filter((member) => member.userId !== senderId)
          .map((member) =>
            ConversationMemberRepository.incrementUnreadCount(
              conversation.id,
              member.userId,
              manager
            )
          ),
      ]);

      const savedAttachments = await MessageAttachmentRepository.findByMessageId(id, manager);
      return {
        members,
        replayed: false,
        savedMessage: {
          id,
          senderId,
          conversation,
          conversationId: conversation.id,
          createdAt,
          ...this.decodeContent(savedMessage),
          attachments: savedAttachments,
          deliveries,
          senderName: sender?.user.username,
        },
      };
    });
  }

  async createGroupMessage(
    senderId: string,
    { conversationId, content, attachments, clientMessageId, location }: GroupMessageDto
  ) {
    return AppDataSource.transaction(async (manager) => {
      const replay = await this.findReplay(manager, senderId, clientMessageId);
      if (replay) {
        if (
          replay.conversationId !== conversationId ||
          replay.conversation.type !== ConversationType.GROUP
        ) {
          throw new ForbiddenException('MESSAGE:CLIENT_ID_ALREADY_USED');
        }
        return {
          savedMessage: {
            ...replay,
            ...this.decodeContent(replay),
            savedAttachments: replay.attachments,
          },
          members: [],
          replayed: true,
          groupName: replay.conversation.name,
          senderName: undefined,
        };
      }
      const [conversation, member, members] = await Promise.all([
        ConversationRepository.findById(conversationId, manager),
        ConversationMemberRepository.findMember(conversationId, senderId, manager),
        ConversationMemberRepository.getMembers(conversationId, manager),
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

      const encoded = this.encodeContent(content, location);

      const message = MessageRepository.create({
        conversationId,
        senderId,
        clientMessageId,
        ...encoded,
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

      await Promise.all([
        MessageDeliveryRepository.createDeliveries(deliveries, manager),

        ConversationRepository.updateLastMessage(conversation.id, savedMessage.id, manager),

        storageService.processMessageAttachments({
          userId: senderId,
          messageId: id,
          attachments,
          manager,
        }),

        ...members
          .filter((member) => member.userId !== senderId)
          .map((member) =>
            ConversationMemberRepository.incrementUnreadCount(
              conversation.id,
              member.userId,
              manager
            )
          ),
      ]);

      const savedAttachments = await MessageAttachmentRepository.findByMessageId(id, manager);

      return {
        savedMessage: {
          id,
          createdAt,
          senderId,
          conversationId,
          ...this.decodeContent(savedMessage),
          savedAttachments,
          deliveries,
        },
        replayed: false,
        members,
        groupName: conversation.name,
        senderName: member.user.username,
      };
    });
  }

  async getConversationMessages(
    userId: string,
    { conversationId, limit, cursor }: GetConversationMessagesDto,
    includeSoftDelete: boolean = true
  ) {
    const member = await ConversationMemberRepository.findMember(conversationId, userId);

    if (!member || member.softDeletedAt) {
      throw new ForbiddenException('CONVERSATION:USER_NOT_MEMBER');
    }

    const [messages, events] = await Promise.all([
      MessageRepository.findByConversation({
        conversationId,
        limit,
        cursor,
        ...(includeSoftDelete ? { lastDeletedAt: member?.emptyMessagesAt } : {}),
      }),
      ConversationEventRepository.findByConversation({
        userId,
        conversationId,
        limit,
        cursor,
        ...(includeSoftDelete ? { lastDeletedAt: member?.emptyMessagesAt } : {}),
      }),
    ]);

    const history = [
      ...messages.map((message) => {
        const {
          deliveries,
          clientMessageId,
          id,
          senderId,
          createdAt,
          conversationId,
          attachments,
        } = message;
        return {
          id,
          senderId,
          createdAt,
          conversationId,
          attachments,
          ...this.decodeContent(message),
          type: 'MESSAGE',
          ...(message.senderId === userId && clientMessageId ? { clientMessageId } : {}),
          deliveries: deliveries
            .filter((delivery) => message.senderId === userId || delivery.userId === userId)
            .map(({ userId, status }) => ({ userId, status })),
        };
      }),
      ...events,
    ];

    history.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const hasMore = history.length > limit;
    const page = history.slice(0, limit);
    const lastItem = page.at(-1);
    const nextCursor =
      hasMore && lastItem ? `${lastItem.createdAt.getTime()}.${lastItem.id}` : null;

    return {
      page,
      nextCursor,
    };
  }

  async updateLiveLocation(userId: string, messageId: string, point?: LocationPoint) {
    return AppDataSource.transaction(async (manager) => {
      const messages = manager.getRepository(Message);
      const message = await messages.findOne({
        where: { id: messageId, senderId: userId, isLocation: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!message?.locationExpiresAt) throw new NotFoundException('LOCATION:NOT_FOUND');

      const membership = await ConversationMemberRepository.findMember(
        message.conversationId,
        userId,
        manager
      );
      if (!membership || membership.softDeletedAt)
        throw new ForbiddenException('LOCATION:NOT_MEMBER');

      const before = this.decodeContent(message).location!;
      if (!point) {
        if (!message.locationStoppedAt) {
          message.locationStoppedAt = new Date();
          await messages.update(message.id, { locationStoppedAt: message.locationStoppedAt });
        }
      } else {
        if (message.locationStoppedAt || message.locationExpiresAt.getTime() <= Date.now()) {
          throw new ForbiddenException('LOCATION:ENDED');
        }
        if (point.capturedAt <= before.capturedAt) return null;
        const encrypted = this.cipherMessage(JSON.stringify(point));
        await messages.update(message.id, encrypted);
        Object.assign(message, encrypted);
      }

      const members = await manager
        .getRepository(ConversationMember)
        .createQueryBuilder('member')
        .where('member.conversationId = :conversationId', {
          conversationId: message.conversationId,
        })
        .andWhere('member.softDeletedAt IS NULL')
        .andWhere('(member.emptyMessagesAt IS NULL OR member.emptyMessagesAt < :createdAt)', {
          createdAt: message.createdAt,
        })
        .andWhere(
          `(member.userId = :userId OR EXISTS (
          SELECT 1 FROM message_deliveries delivery
          WHERE delivery.message_id = :messageId AND delivery.user_id = member.user_id
        ))`,
          { userId, messageId }
        )
        .getMany();
      return {
        memberIds: members.map((member) => member.userId),
        data: { messageId, location: this.decodeContent(message).location! },
      };
    });
  }

  async getRecentLiveLocations(userId: string) {
    const messages = await MessageRepository.createQueryBuilder('message')
      .innerJoin(
        ConversationMember,
        'member',
        `
        member.conversationId = message.conversationId AND member.userId = :userId
        AND member.softDeletedAt IS NULL
        AND (member.emptyMessagesAt IS NULL OR member.emptyMessagesAt < message.createdAt)
      `,
        { userId }
      )
      .where('message.locationExpiresAt > NOW()')
      .andWhere(
        `(message.senderId = :userId OR EXISTS (
        SELECT 1 FROM message_deliveries delivery
        WHERE delivery.message_id = message.id AND delivery.user_id = :userId
      ))`
      )
      .getMany();
    return messages.map((message) => ({
      messageId: message.id,
      location: this.decodeContent(message).location!,
    }));
  }

  async confirmDelivery(userId: string, { conversationId, messageId, status }: MessageDeliveryDto) {
    return AppDataSource.transaction(async (manager) => {
      const delivery = await MessageDeliveryRepository.findByMessageAndUser(
        messageId,
        userId,
        manager
      );
      if (!delivery || delivery.message.conversationId !== conversationId) {
        throw new NotFoundException('CONFIRM_DELIVERY:DELIVERY_NOT_FOUND');
      }
      const changed = await MessageDeliveryRepository.advanceStatus(delivery.id, status, manager);
      if (changed && status === MessageStatus.READ) {
        await ConversationMemberRepository.decrementUnreadCount(
          conversationId,
          userId,
          delivery.message.createdAt,
          manager
        );
      }
      return { delivery, changed };
    });
  }

  async deleteMessages(dto: DeleteMessagesDto) {
    return await MessageRepository.deleteMessages(dto);
  }
}

export const messageService = new MessageService();
