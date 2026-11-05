import { In, LessThanOrEqual, MoreThan } from 'typeorm';
import { AppDataSource } from '@config/database';
import { CALL_RING_TIMEOUT_MS } from '@constants';
import { CallStatus } from '@appTypes';
import { Call } from '@entities';

type CreateCallData = Pick<
  Call,
  'callerId' | 'calleeId' | 'media' | 'callerConnectionId' | 'requestId'
>;

export const CallRepository = AppDataSource.getRepository(Call).extend({
  async createIfParticipantsAvailable(data: CreateCallData) {
    return this.manager.transaction('READ COMMITTED', async (manager) => {
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

      // Resolve retries before checking participant availability.
      const existingCall = await repository.findOne({
        where: {
          callerId: data.callerId,
          requestId: data.requestId,
        },
      });

      if (existingCall) {
        return {
          call: existingCall,
          created: false,
        };
      }

      const activeStatuses = [CallStatus.RINGING, CallStatus.ACCEPTED];

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
        status: CallStatus.RINGING,
        acceptedAt: null,
        endedAt: null,
        expiresAt: new Date(Date.now() + CALL_RING_TIMEOUT_MS),
      });

      const savedCall = await repository.save(call);

      return {
        call: savedCall,
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
        }
      );

      if (result.affected === 1) {
        const call = await repository.findOneByOrFail({
          id: callId,
        });

        return { call, changed: true };
      }

      // Only the connection that accepted can retry successfully.
      const call = await repository.findOne({
        where: {
          id: callId,
          calleeId,
          calleeConnectionId,
          status: CallStatus.ACCEPTED,
        },
      });

      if (!call) {
        return null;
      }

      return { call, changed: false };
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
        }
      );

      if (result.affected === 1) {
        const call = await repository.findOneByOrFail({
          id: callId,
        });

        return { call, changed: true };
      }

      // A repeated rejection must belong to the same callee.
      const call = await repository.findOne({
        where: {
          id: callId,
          calleeId,
          status: CallStatus.REJECTED,
        },
      });

      if (!call) {
        return null;
      }

      return { call, changed: false };
    });
  },

  async endIfAllowed(callId: string, userId: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);

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
            status: CallStatus.ACCEPTED,
          },
          {
            id: callId,
            calleeId: userId,
            status: CallStatus.ACCEPTED,
          },
        ],
        {
          status: CallStatus.ENDED,
          endedAt: new Date(),
          expiresAt: null,
        }
      );

      if (result.affected === 1) {
        const call = await repository.findOneByOrFail({
          id: callId,
        });

        return { call, changed: true };
      }

      // A participant can acknowledge an already ended call.
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

      if (!call) {
        return null;
      }

      return { call, changed: false };
    });
  },

  async findAcceptedForOffer(callId: string, callerId: string, callerConnectionId: string) {
    return this.findOne({
      where: {
        id: callId,
        callerId,
        callerConnectionId,
        status: CallStatus.ACCEPTED,
      },
    });
  },

  async findAcceptedForAnswer(callId: string, calleeId: string, calleeConnectionId: string) {
    return this.findOne({
      where: {
        id: callId,
        calleeId,
        calleeConnectionId,
        status: CallStatus.ACCEPTED,
      },
    });
  },

  async findAcceptedForIceCandidate(callId: string, userId: string, connectionId: string) {
    return this.findOne({
      where: [
        {
          id: callId,
          callerId: userId,
          callerConnectionId: connectionId,
          status: CallStatus.ACCEPTED,
        },
        {
          id: callId,
          calleeId: userId,
          calleeConnectionId: connectionId,
          status: CallStatus.ACCEPTED,
        },
      ],
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
        }
      );

      if (result.affected !== 1) {
        return null;
      }

      return repository.findOneByOrFail({ id: callId });
    });
  },

  async expireRinging() {
    const now = new Date();

    const result = await this.createQueryBuilder()
      .update(Call)
      .set({
        status: CallStatus.MISSED,
        endedAt: now,
      })
      .where('"status" = :status', {
        status: CallStatus.RINGING,
      })
      .andWhere('"expires_at" <= :now', { now })
      .returning(['id', 'callerId', 'calleeId', 'endedAt'])
      .execute();

    return result.raw as Array<{
      id: string;
      caller_id: string;
      callee_id: string;
      ended_at: Date;
    }>;
  },

  async endByDisconnectedConnection(userId: string, connectionId: string) {
    const result = await this.createQueryBuilder()
      .update(Call)
      .set({
        status: CallStatus.ENDED,
        endedAt: new Date(),
        expiresAt: null,
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
          callerStatuses: [CallStatus.RINGING, CallStatus.ACCEPTED],
        }
      )
      .orWhere(
        `(
        callee_id = :userId
        AND callee_connection_id = :connectionId
        AND status = :acceptedStatus
      )`,
        {
          userId,
          connectionId,
          acceptedStatus: CallStatus.ACCEPTED,
        }
      )
      .returning(['id', 'callerId', 'calleeId', 'endedAt'])
      .execute();

    return result.raw as Array<{
      id: string;
      caller_id: string;
      callee_id: string;
      ended_at: Date;
    }>;
  },
});
