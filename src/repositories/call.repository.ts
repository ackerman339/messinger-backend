import { In, LessThanOrEqual, MoreThan } from 'typeorm';
import { AppDataSource } from '@config/database';
import { CALL_RING_TIMEOUT_MS, WS_CLIENT_EVENTS, CALL_CONNECTION_TIMEOUT_MS } from '@constants';
import { CallStatus } from '@appTypes';
import { CallSignalAckDto } from '@dtos';
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
          connectionExpiresAt: new Date(now.getTime() + CALL_CONNECTION_TIMEOUT_MS),
        }
      );

      if (result.affected === 1) {
        const call = await repository.findOneByOrFail({
          id: callId,
        });

        return { call, changed: true };
      }

      // Retries preserve the original deadline.
      const call = await repository.findOne({
        where: {
          id: callId,
          calleeId,
          calleeConnectionId,
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
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
        }
      );

      if (result.affected === 1) {
        const call = await repository.findOneByOrFail({
          id: callId,
        });

        return { call, changed: true };
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

      if (!call) {
        return null;
      }

      return { call, changed: false };
    });
  },

  async registerOffer(
    callId: string,
    callerId: string,
    callerConnectionId: string,
    signalId: string
  ) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);

      const call = await repository.findOne({
        where: {
          id: callId,
          callerId,
          callerConnectionId,
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!call || !call.calleeConnectionId) {
        return null;
      }

      if (call.offerHash !== null) {
        return call.offerHash === signalId ? call : null;
      }

      call.offerHash = signalId;

      return repository.save(call);
    });
  },

  async registerAnswer(
    callId: string,
    calleeId: string,
    calleeConnectionId: string,
    signalId: string
  ) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);

      const call = await repository.findOne({
        where: {
          id: callId,
          calleeId,
          calleeConnectionId,
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
        },
        lock: { mode: 'pessimistic_write' },
      });

      // An answer requires a previously registered offer.
      if (!call || call.offerHash === null) {
        return null;
      }

      if (call.answerHash !== null) {
        return call.answerHash === signalId ? call : null;
      }

      call.answerHash = signalId;

      return repository.save(call);
    });
  },

  async findForSignalAck(
    userId: string,
    connectionId: string,
    { callId, signalType, signalId }: CallSignalAckDto
  ) {
    if (signalType === WS_CLIENT_EVENTS.CALL_OFFER) {
      return this.findOne({
        where: {
          id: callId,
          calleeId: userId,
          calleeConnectionId: connectionId,
          offerHash: signalId,
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
        },
      });
    }

    return this.findOne({
      where: {
        id: callId,
        callerId: userId,
        callerConnectionId: connectionId,
        answerHash: signalId,
        status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
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
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
        },
        {
          id: callId,
          calleeId: userId,
          calleeConnectionId: connectionId,
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
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
        connectionExpiresAt: null,
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

    return result.raw as Array<{
      id: string;
      caller_id: string;
      callee_id: string;
      ended_at: Date;
    }>;
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

      // An already completed transition is safe to acknowledge again.
      if (call.status === CallStatus.CONNECTED) {
        return { call, becameConnected: false };
      }

      // Evaluate the deadline after acquiring the row lock.
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

      const savedCall = await repository.save(call);

      return {
        call: savedCall,
        becameConnected,
      };
    });
  },

  async expireConnecting() {
    const now = new Date();

    const result = await this.createQueryBuilder()
      .update(Call)
      .set({
        status: CallStatus.FAILED,
        endedAt: now,
        expiresAt: null,
        connectionExpiresAt: null,
      })
      .where('"status" = :status', {
        status: CallStatus.ACCEPTED,
      })
      .andWhere('"connection_expires_at" <= :now', { now })
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
