import { ConversationEventRepository } from './conversation-event.repository';
import {
  EntityManager,
  Not,
  IsNull,
  In,
  LessThanOrEqual,
  MoreThan,
  FindOptionsWhere,
  LessThan,
} from 'typeorm';
import { AppDataSource } from '@config/database';
import { CallHistoryDto } from '@dtos';
import { CALL_CONNECTION_TIMEOUT_MS, CALL_RING_TIMEOUT_MS } from '@constants';
import { CallStatus, CallNegotiationStatus } from '@appTypes';
import { Call, CallNegotiation } from '@entities';

import { CallNegotiationRepository } from './call-negotiation.repository';

type CreateCallData = Pick<
  Call,
  'callerId' | 'calleeId' | 'callerConnectionId' | 'media' | 'requestId' | 'conversationId'
>;

type ClosedCallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  ended_at: Date;
};

export const CallRepository = AppDataSource.getRepository(Call).extend({
  async createIfParticipantsAvailable(data: CreateCallData) {
    return this.manager.transaction('READ COMMITTED', async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(
            hashtextextended($1::text, 0)
          )`,
        [`call:request:${data.requestId}`]
      );

      const participantIds = [data.callerId, data.calleeId].sort();

      for (const userId of participantIds) {
        await manager.query(
          `SELECT pg_advisory_xact_lock(
              hashtextextended($1::text, 0)
            )`,
          [`call:user:${userId}`]
        );
      }

      const repository = manager.getRepository(Call);

      const existingCall = await repository.findOne({
        where: { requestId: data.requestId },
      });

      if (existingCall) {
        return {
          call: existingCall,
          created: false,
        };
      }

      const activeStatuses = [CallStatus.RINGING, CallStatus.ACCEPTED, CallStatus.CONNECTED];

      const activeCall = await repository.findOne({
        where: [
          {
            callerId: In(participantIds),
            status: In(activeStatuses),
          },
          {
            calleeId: In(participantIds),
            status: In(activeStatuses),
          },
        ],
      });

      if (activeCall) {
        return null;
      }

      const call = repository.create({
        ...data,
        calleeConnectionId: null,
        currentNegotiationId: null,
        status: CallStatus.RINGING,
        acceptedAt: null,
        callerConnectedAt: null,
        calleeConnectedAt: null,
        connectedAt: null,
        endedAt: null,
        connectionExpiresAt: null,
        recoveryExpiresAt: null,
        expiresAt: new Date(Date.now() + CALL_RING_TIMEOUT_MS),
      });

      return {
        call: await repository.save(call),
        created: true,
      };
    });
  },

  async acceptIfRinging(callId: string, calleeId: string, calleeConnectionId: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);
      const now = new Date();

      const result = await repository.update(
        {
          id: callId,
          calleeId,
          status: CallStatus.RINGING,
          expiresAt: MoreThan(now),
        },
        {
          status: CallStatus.ACCEPTED,
          calleeConnectionId,
          acceptedAt: now,
          expiresAt: null,
          connectionExpiresAt: new Date(now.getTime() + CALL_CONNECTION_TIMEOUT_MS),
        }
      );

      if (result.affected === 1) {
        return {
          call: await repository.findOneByOrFail({ id: callId }),
          changed: true,
        };
      }

      const call = await repository.findOne({
        where: {
          id: callId,
          calleeId,
          calleeConnectionId,
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
        },
      });

      return call ? { call, changed: false } : null;
    });
  },

  async rejectIfRinging(callId: string, calleeId: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);

      const result = await repository.update(
        {
          id: callId,
          calleeId,
          status: CallStatus.RINGING,
        },
        {
          status: CallStatus.REJECTED,
          endedAt: new Date(),
          expiresAt: null,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        }
      );

      if (result.affected === 1) {
        await CallNegotiationRepository.cancelPendingForCall(manager, callId);

        return {
          call: await repository.findOneByOrFail({ id: callId }),
          changed: true,
        };
      }

      const call = await repository.findOne({
        where: {
          id: callId,
          calleeId,
          status: CallStatus.REJECTED,
        },
      });

      return call ? { call, changed: false } : null;
    });
  },

  async endIfAllowed(callId: string, userId: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);

      const establishedStatuses = [CallStatus.ACCEPTED, CallStatus.CONNECTED];

      const result = await repository.update(
        [
          {
            id: callId,
            callerId: userId,
            status: CallStatus.RINGING,
          },
          {
            id: callId,
            callerId: userId,
            status: In(establishedStatuses),
          },
          {
            id: callId,
            calleeId: userId,
            status: In(establishedStatuses),
          },
        ],
        {
          status: CallStatus.ENDED,
          endedAt: new Date(),
          expiresAt: null,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        }
      );

      if (result.affected === 1) {
        await CallNegotiationRepository.cancelPendingForCall(manager, callId);

        return {
          call: await repository.findOneByOrFail({ id: callId }),
          changed: true,
        };
      }

      const call = await repository.findOne({
        where: [
          {
            id: callId,
            callerId: userId,
            status: CallStatus.ENDED,
          },
          {
            id: callId,
            calleeId: userId,
            status: CallStatus.ENDED,
          },
        ],
      });

      return call ? { call, changed: false } : null;
    });
  },

  async timeoutIfExpired(callId: string, callerId: string, callerConnectionId: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);
      const now = new Date();

      const result = await repository.update(
        {
          id: callId,
          callerId,
          callerConnectionId,
          status: CallStatus.RINGING,
          expiresAt: LessThanOrEqual(now),
        },
        {
          status: CallStatus.MISSED,
          endedAt: now,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        }
      );

      if (result.affected !== 1) {
        return null;
      }

      await CallNegotiationRepository.cancelPendingForCall(manager, callId);

      return repository.findOneOrFail({
        where: { id: callId },
        relations: { caller: true },
        select: {
          id: true,
          conversationId: true,
          callerHistoryDeletedAt: true,
          calleeHistoryDeletedAt: true,
          media: true,
          status: true,
          callerId: true,
          calleeId: true,
          endedAt: true,
          caller: { id: true, username: true },
        },
      });
    });
  },

  async reportConnected(callId: string, userId: string, connectionId: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);

      const statuses = [CallStatus.ACCEPTED, CallStatus.CONNECTED];

      const call = await repository.findOne({
        where: [
          {
            id: callId,
            callerId: userId,
            callerConnectionId: connectionId,
            status: In(statuses),
          },
          {
            id: callId,
            calleeId: userId,
            calleeConnectionId: connectionId,
            status: In(statuses),
          },
        ],
        lock: { mode: 'pessimistic_write' },
      });

      if (!call) {
        return null;
      }

      if (call.status === CallStatus.CONNECTED) {
        return { call, becameConnected: false };
      }

      const now = new Date();

      if (!call.connectionExpiresAt || call.connectionExpiresAt.getTime() <= now.getTime()) {
        return null;
      }

      const isCaller = call.callerId === userId;

      if (isCaller) {
        if (call.callerConnectedAt) {
          return { call, becameConnected: false };
        }

        call.callerConnectedAt = now;
      } else {
        if (call.calleeConnectedAt) {
          return { call, becameConnected: false };
        }

        call.calleeConnectedAt = now;
      }

      const becameConnected = Boolean(call.callerConnectedAt && call.calleeConnectedAt);

      if (becameConnected) {
        call.status = CallStatus.CONNECTED;
        call.connectedAt = now;
        call.connectionExpiresAt = null;
      }

      return {
        call: await repository.save(call),
        becameConnected,
      };
    });
  },

  async endByDisconnectedConnection(userId: string, connectionId: string) {
    return this.manager.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(Call)
        .set({
          status: CallStatus.ENDED,
          endedAt: new Date(),
          expiresAt: null,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        })
        .where(
          `(
            caller_id = :userId
            AND caller_connection_id = :connectionId
            AND status IN (:...callerStatuses)
          )`,
          {
            userId,
            connectionId,
            callerStatuses: [CallStatus.RINGING, CallStatus.ACCEPTED, CallStatus.CONNECTED],
          }
        )
        .orWhere(
          `(
            callee_id = :userId
            AND callee_connection_id = :connectionId
            AND status IN (:...calleeStatuses)
          )`,
          {
            userId,
            connectionId,
            calleeStatuses: [CallStatus.ACCEPTED, CallStatus.CONNECTED],
          }
        )
        .returning(['id', 'callerId', 'calleeId', 'endedAt'])
        .execute();

      const calls = result.raw as ClosedCallRow[];

      for (const call of calls) {
        await CallNegotiationRepository.cancelPendingForCall(manager, call.id);
      }

      return calls;
    });
  },

  async expireRinging() {
    return this.manager.transaction(async (manager) => {
      const now = new Date();

      const result = await manager
        .createQueryBuilder()
        .update(Call)
        .set({
          status: CallStatus.MISSED,
          endedAt: now,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        })
        .where('"status" = :status', {
          status: CallStatus.RINGING,
        })
        .andWhere('"expires_at" <= :now', { now })
        .returning(['id', 'callerId', 'calleeId', 'endedAt'])
        .execute();

      const calls = result.raw as ClosedCallRow[];

      for (const call of calls) {
        await CallNegotiationRepository.cancelPendingForCall(manager, call.id);
      }

      if (!calls.length) return [];
      return manager.getRepository(Call).find({
        where: { id: In(calls.map((call) => call.id)) },
        relations: { caller: true },
        select: {
          id: true,
          conversationId: true,
          callerHistoryDeletedAt: true,
          calleeHistoryDeletedAt: true,
          media: true,
          status: true,
          callerId: true,
          calleeId: true,
          endedAt: true,
          caller: { id: true, username: true },
        },
      });
    });
  },

  async expireConnecting() {
    return this.manager.transaction(async (manager) => {
      const now = new Date();

      const result = await manager
        .createQueryBuilder()
        .update(Call)
        .set({
          status: CallStatus.FAILED,
          endedAt: now,
          expiresAt: null,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        })
        .where('"status" = :status', {
          status: CallStatus.ACCEPTED,
        })
        .andWhere('"connection_expires_at" <= :now', { now })
        .returning(['id', 'callerId', 'calleeId', 'endedAt'])
        .execute();

      const calls = result.raw as ClosedCallRow[];

      for (const call of calls) {
        await CallNegotiationRepository.cancelPendingForCall(manager, call.id);
      }

      return calls;
    });
  },

  async expireRecovery() {
    return this.manager.transaction(async (manager) => {
      const now = new Date();

      const result = await manager
        .createQueryBuilder()
        .update(Call)
        .set({
          status: CallStatus.FAILED,
          endedAt: now,
          expiresAt: null,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        })
        .where('"status" = :status', {
          status: CallStatus.CONNECTED,
        })
        .andWhere('"recovery_expires_at" <= :now', { now })
        .returning(['id', 'callerId', 'calleeId', 'endedAt'])
        .execute();

      const calls = result.raw as ClosedCallRow[];

      for (const call of calls) {
        await CallNegotiationRepository.cancelPendingForCall(manager, call.id);
      }

      return calls;
    });
  },

  async findStateForParticipant(
    userId: string,
    selector: {
      callId?: string;
      requestId?: string;
    }
  ) {
    return this.manager.transaction('REPEATABLE READ', async (manager) => {
      const repository = manager.getRepository(Call);

      const lookup = selector.callId ? { id: selector.callId } : { requestId: selector.requestId! };

      const call = await repository.findOne({
        where: [
          {
            ...lookup,
            callerId: userId,
          },
          {
            ...lookup,
            calleeId: userId,
          },
        ],
      });

      if (!call) {
        return null;
      }

      const negotiation = call.currentNegotiationId
        ? await manager.getRepository(CallNegotiation).findOne({
            where: {
              id: call.currentNegotiationId,
              callId: call.id,
            },
          })
        : null;

      return {
        call,
        negotiation,
      };
    });
  },

  async reconcileAfterRestart() {
    return this.manager.transaction(async (manager) => {
      const now = new Date();

      const callsResult = await manager.getRepository(Call).update(
        {
          status: In([CallStatus.RINGING, CallStatus.ACCEPTED, CallStatus.CONNECTED]),
        },
        {
          status: CallStatus.FAILED,
          endedAt: now,
          expiresAt: null,
          connectionExpiresAt: null,
          recoveryExpiresAt: null,
        }
      );

      // Also clean pending negotiations from previously terminated calls.
      const negotiationsResult = await manager.getRepository(CallNegotiation).update(
        {
          status: In([
            CallNegotiationStatus.PENDING,
            CallNegotiationStatus.OFFERED,
            CallNegotiationStatus.ANSWERED,
          ]),
        },
        {
          status: CallNegotiationStatus.CANCELLED,
          endedAt: now,
        }
      );

      return {
        callsClosed: callsResult.affected ?? 0,
        negotiationsCancelled: negotiationsResult.affected ?? 0,
      };
    });
  },

  async getHistory(userId: string, { limit, cursor }: CallHistoryDto) {
    let cursorCall: Pick<Call, 'id' | 'createdAt'> | null = null;

    if (cursor?.includes('.')) {
      const [timestamp, id] = cursor.split('.');
      cursorCall = { id, createdAt: new Date(Number(timestamp)) };
    } else if (cursor) {
      cursorCall = await this.findOne({
        where: [
          { id: cursor, callerId: userId },
          { id: cursor, calleeId: userId },
        ],
        select: {
          id: true,
          createdAt: true,
        },
      });
    }

    const callerWhere = { callerId: userId, callerHistoryDeletedAt: IsNull() };
    const calleeWhere = { calleeId: userId, calleeHistoryDeletedAt: IsNull() };

    const where: FindOptionsWhere<Call>[] = cursorCall
      ? [
          {
            ...callerWhere,
            createdAt: LessThan(cursorCall.createdAt),
          },
          {
            ...calleeWhere,
            createdAt: LessThan(cursorCall.createdAt),
          },
          {
            ...callerWhere,
            createdAt: cursorCall.createdAt,
            id: LessThan(cursorCall.id),
          },
          {
            ...calleeWhere,
            createdAt: cursorCall.createdAt,
            id: LessThan(cursorCall.id),
          },
        ]
      : [callerWhere, calleeWhere];

    return this.find({
      where,
      relations: {
        caller: true,
        callee: true,
      },
      select: {
        id: true,
        callerId: true,
        calleeId: true,
        media: true,
        status: true,
        createdAt: true,
        acceptedAt: true,
        connectedAt: true,
        endedAt: true,
        caller: {
          id: true,
          username: true,
        },
        callee: {
          id: true,
          username: true,
        },
      },
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      take: limit + 1,
    });
  },

  async deleteHistory(userId: string, callId?: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);
      const now = new Date();
      const callFilter = callId ? { id: callId } : {};
      // Lock the same rows in a stable order for simultaneous/bulk deletions.
      const historyCalls = await repository.find({
        where: [
          { ...callFilter, callerId: userId },
          { ...callFilter, calleeId: userId },
        ],
        select: { id: true },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!historyCalls.length) return 0;
      const ids = historyCalls.map((call) => call.id);
      const caller = await repository.update(
        { id: In(ids), callerId: userId, callerHistoryDeletedAt: IsNull() },
        { callerHistoryDeletedAt: now }
      );
      const callee = await repository.update(
        { id: In(ids), calleeId: userId, calleeHistoryDeletedAt: IsNull() },
        { calleeHistoryDeletedAt: now }
      );
      await this.purgeDeletedHistory(manager, { userId, callId });
      return (caller.affected ?? 0) + (callee.affected ?? 0);
    });
  },

  async purgeDeletedHistory(
    manager?: EntityManager,
    scope: { callId?: string; userId?: string } = {}
  ): Promise<void> {
    if (!manager) {
      await this.manager.transaction((transaction) => this.purgeDeletedHistory(transaction, scope));
      return;
    }
    const repository = manager.getRepository(Call);
    const conditions = {
      callerHistoryDeletedAt: Not(IsNull()),
      calleeHistoryDeletedAt: Not(IsNull()),
      status: In([CallStatus.ENDED, CallStatus.REJECTED, CallStatus.MISSED, CallStatus.FAILED]),
      ...(scope.callId ? { id: scope.callId } : {}),
    };
    const calls = await repository.find({
      where: scope.userId
        ? [
            { ...conditions, callerId: scope.userId },
            { ...conditions, calleeId: scope.userId },
          ]
        : conditions,
      select: { id: true },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!calls.length) return;
    const ids = calls.map((call) => call.id);
    await ConversationEventRepository.deleteCallEvents(ids, manager);
    // Negotiations are removed by their existing ON DELETE CASCADE foreign key.
    await repository.delete(ids);
  },
});
