import { EntityManager } from 'typeorm';
import { AppDataSource } from '@config/database';
import { MessageDelivery } from '@entities';
import { MessageStatus } from '@appTypes';

type DeliveryInput = Pick<MessageDelivery, 'messageId' | 'userId' | 'status'>;

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

  async findByMessageAndUser(messageId: string, userId: string, manager: EntityManager) {
    return manager.getRepository(MessageDelivery).findOne({
      where: {
        messageId,
        userId,
      },
      relations: { message: true },
    });
  },

  async advanceStatus(
    id: string,
    status: MessageStatus.DELIVERED | MessageStatus.READ,
    manager: EntityManager
  ) {
    const read = status === MessageStatus.READ;
    const result = await manager
      .getRepository(MessageDelivery)
      .createQueryBuilder()
      .update()
      .set({
        status,
        deliveredAt: () => 'COALESCE(delivered_at, CURRENT_TIMESTAMP)',
        ...(read ? { readAt: () => 'CURRENT_TIMESTAMP' } : {}),
      })
      .where('id = :id', { id })
      .andWhere('status IN (:...previous)', {
        previous: read ? [MessageStatus.SENT, MessageStatus.DELIVERED] : [MessageStatus.SENT],
      })
      .execute();
    return (result.affected ?? 0) > 0;
  },
});
