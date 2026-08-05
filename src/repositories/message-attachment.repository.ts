import { AppDataSource } from '@config/database';
import { MessageAttachment } from '@entities';
import { EntityManager } from 'typeorm';

export const MessageAttachmentRepository = AppDataSource.getRepository(MessageAttachment).extend({
  async createAttachments(attachments: Partial<MessageAttachment>[], manager?: EntityManager) {
    const repository = manager ? manager.getRepository(MessageAttachment) : this;

    if (attachments.length === 0) {
      return;
    }

    await repository.insert(attachments);
  },

  async findByMessageId(messageId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(MessageAttachment) : this;

    return repository.find({ where: { messageId } });
  },
});
