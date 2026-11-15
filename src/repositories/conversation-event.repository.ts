import { EntityManager, MoreThan, LessThan, Raw, FindOptionsWhere, In } from 'typeorm';
import { AppDataSource } from '@config/database';
import { ConversationEventType } from '@appTypes';
import { ConversationEvent, Message, Call } from '@entities';

type FindMessagesParams = {
  limit: number;
  conversationId: string;
  cursor?: string;
  userId: string;
  lastDeletedAt?: Date | null;
};

export const ConversationEventRepository = AppDataSource.getRepository(ConversationEvent).extend({
  async createEvent(event: Partial<ConversationEvent>, manager?: EntityManager) {
    const save = async (transaction: EntityManager) => {
      if (
        (event.type === ConversationEventType.CALL_ACCEPTED ||
          event.type === ConversationEventType.CALL_END) &&
        typeof event.metadata?.callId === 'string'
      ) {
        // Serialize event creation with physical deletion of its call.
        const call = await transaction.getRepository(Call).findOne({
          where: { id: event.metadata.callId },
          select: { id: true },
          lock: { mode: 'pessimistic_read' },
        });
        if (!call) return;
      }
      const repository = transaction.getRepository(ConversationEvent);
      return repository.save(repository.create(event));
    };
    return manager ? save(manager) : this.manager.transaction(save);
  },

  async deleteCallEvents(callIds: string[], manager: EntityManager) {
    if (!callIds.length) return;
    await manager.getRepository(ConversationEvent).delete({
      type: In([ConversationEventType.CALL_ACCEPTED, ConversationEventType.CALL_END]),
      metadata: Raw((column) => `${column} ->> 'callId' IN (:...deletedCallIds)`, {
        deletedCallIds: callIds,
      }),
    });
  },

  async findByConversation({
    conversationId,
    limit,
    cursor,
    userId,
    lastDeletedAt,
  }: FindMessagesParams) {
    let cursorEvent: Pick<ConversationEvent, 'id' | 'createdAt'> | null = null;

    const where: FindOptionsWhere<ConversationEvent> = {
      conversationId,
    };

    // Call events share their participants' history deletion state.
    where.metadata = Raw(
      (column) => `NOT EXISTS (
        SELECT 1 FROM calls hidden_call
        WHERE hidden_call.id = (${column} ->> 'callId')::uuid
          AND (
            (hidden_call.caller_id = :historyUserId AND hidden_call.caller_history_deleted_at IS NOT NULL)
            OR (hidden_call.callee_id = :historyUserId AND hidden_call.callee_history_deleted_at IS NOT NULL)
          )
      )`,
      { historyUserId: userId }
    );

    if (cursor?.includes('.')) {
      const [timestamp, id] = cursor.split('.');
      cursorEvent = { id, createdAt: new Date(Number(timestamp)) };
    } else if (cursor) {
      cursorEvent = await this.findOne({
        where: {
          id: cursor,
          conversationId,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    }

    // The shared history cursor can belong to a message or a conversation event.
    if (cursor && !cursorEvent) {
      cursorEvent = await AppDataSource.getRepository(Message).findOne({
        where: { id: cursor, conversationId },
        select: { id: true, createdAt: true },
      });
    }

    if (lastDeletedAt && cursorEvent) {
      where.createdAt = Raw(
        (column) => `${column} > :lastDeletedAt AND ${column} < :cursorCreatedAt`,
        {
          lastDeletedAt,
          cursorCreatedAt: cursorEvent.createdAt,
        }
      );
    } else if (cursorEvent) {
      where.createdAt = LessThan(cursorEvent.createdAt);
    } else if (lastDeletedAt) {
      where.createdAt = MoreThan(lastDeletedAt);
    }

    return this.find({
      where,
      order: {
        createdAt: 'DESC',
      },
      take: limit + 1,
    });
  },
});
