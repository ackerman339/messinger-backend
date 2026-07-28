import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { env } from '@config/environment';
import { AppDataSource } from '@config/database';
import { MessageStatus, ConversationType } from '@appTypes';
import { NotFoundException } from '@exceptions';
import { conversationService } from '@services';
import { PrivateMessageDto, MessageDeliveryDto } from '@dtos';
import {
  ConversationRepository,
  MessageDeliveryRepository,
  MessageRepository,
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

  private decipherMessage(encryptedContent: string, iv: string, authTag: string) {
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

    const members = await ConversationRepository.getConversationMembers(conversation.id);

    const result = await AppDataSource.transaction(async (manager) => {
      const newMessage = MessageRepository.create({
        conversationId: conversation.id,
        senderId,
        cipheredContent,
        iv,
        authTag,
      });

      const savedMessage = await MessageRepository.saveMessage(newMessage, manager);

      const deliveries = members
        .filter((member) => member.userId !== senderId)
        .map((member) => ({
          messageId: savedMessage.id,
          userId: member.userId,
          status: MessageStatus.SENT,
        }));

      MessageDeliveryRepository.createDeliveries(deliveries, manager);

      return savedMessage;
    });

    return {
      members,
      savedMessage: result,
    };
  }

  async getConversationMessages(conversationId: string) {
    const messages = await MessageRepository.findByConversation(conversationId);

    return messages.map((message) => ({
      ...message,
      content: this.decipherMessage(message.cipheredContent, message.iv, message.authTag),
    }));
  }

  async confirmDelivery(userId: string, { messageId, status }: MessageDeliveryDto) {
    const delivery = await MessageDeliveryRepository.findByMessageAndUser(messageId, userId);

    if (!delivery) {
      throw new NotFoundException('COMFIRM_DELIVERY:DELIVERY_NOT_FOUND');
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
