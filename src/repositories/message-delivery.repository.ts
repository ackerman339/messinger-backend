import { EntityManager } from 'typeorm';
import { AppDataSource } from '@config/database';
import { MessageDelivery } from '@entities';

type DeliveryInput = Pick<MessageDelivery, 'messageId' | 'userId' | 'status'>;

type DeliveryStatusInput = Partial<Pick<MessageDelivery, 'status' | 'deliveredAt' | 'readAt'>>;

export const MessageDeliveryRepository = AppDataSource.getRepository(MessageDelivery).extend({
  async createDeliveries(deliveries: DeliveryInput[], manager?: EntityManager) {
    const repository = manager ? manager.getRepository(MessageDelivery) : this;

    return repository.insert(deliveries);
  },

  async findById(id: string) {
    return this.findOne({
      where: {
        id,
      },
    });
  },

  async findByMessageId(messageId: string) {
    return this.find({
      where: {
        messageId,
      },
    });
  },

  async findByMessageAndUser(messageId: string, userId: string) {
    return this.findOne({
      where: {
        messageId,
        userId,
      },
      relations: { message: true },
    });
  },

  async updateDeliveryStatus(id: string, data: DeliveryStatusInput) {
    return this.update(id, data);
  },
});
