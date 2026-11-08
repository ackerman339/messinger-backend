import { EntityManager, In, LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '@config/database';
import { CALL_RECOVERY_TIMEOUT_MS } from '@constants';
import { CallNegotiationStatus, CallNegotiationType, CallStatus } from '@appTypes';
import { Call, CallNegotiation } from '@entities';

const ACTIVE_STATUSES = [
  CallNegotiationStatus.PENDING,
  CallNegotiationStatus.OFFERED,
  CallNegotiationStatus.ANSWERED,
];

type CreateNegotiationData = {
  callId: string;
  requestId: string;
  type: CallNegotiationType;
  userId: string;
  connectionId: string;
  timeoutMs: number;
};

type CreateNegotiationResult =
  | {
      success: false;
      code: string;
    }
  | {
      success: true;
      negotiation: CallNegotiation;
      created: boolean;
      recoveryExpiresAt: Date | null;
    };

type SignalAction =
  | { kind: 'offer'; signalId: string }
  | { kind: 'answer'; signalId: string }
  | {
      kind: 'ack';
      signalType: 'CALL_OFFER' | 'CALL_ANSWER';
      signalId: string;
    }
  | { kind: 'ice' };

type SignalData = {
  callId: string;
  negotiationId: string;
  userId: string;
  connectionId: string;
  action: SignalAction;
};

type ExpirationResult = {
  callId: string;
  negotiationId: string;
  type: CallNegotiationType;
  status: CallNegotiationStatus;
  endedAt: Date;
  callerId: string;
  calleeId: string;
  callerConnectionId: string;
  calleeConnectionId: string | null;
};

export const CallNegotiationRepository = AppDataSource.getRepository(CallNegotiation).extend({
  async createIfAvailable(data: CreateNegotiationData): Promise<CreateNegotiationResult> {
    return this.manager.transaction('READ COMMITTED', async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(
              hashtextextended($1::text, 0)
            )`,
        [`call:negotiation:request:${data.requestId}`]
      );

      const callRepository = manager.getRepository(Call);
      const repository = manager.getRepository(CallNegotiation);

      const call = await callRepository.findOne({
        where: { id: data.callId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!call) {
        return {
          success: false,
          code: 'CALL_NEGOTIATION_NOT_ALLOWED',
        };
      }

      const isCaller =
        call.callerId === data.userId && call.callerConnectionId === data.connectionId;

      const isCallee =
        call.calleeId === data.userId && call.calleeConnectionId === data.connectionId;

      if (!isCaller && !isCallee) {
        return {
          success: false,
          code: 'CALL_NEGOTIATION_NOT_ALLOWED',
        };
      }

      const existing = await repository.findOne({
        where: { requestId: data.requestId },
      });

      if (existing) {
        if (
          existing.callId !== data.callId ||
          existing.offererId !== data.userId ||
          existing.type !== data.type
        ) {
          return {
            success: false,
            code: 'CALL_NEGOTIATION_REQUEST_CONFLICT',
          };
        }

        return {
          success: true,
          negotiation: existing,
          created: false,
          recoveryExpiresAt: call.recoveryExpiresAt,
        };
      }

      // SDP completion does not release an ongoing recovery.
      if (call.recoveryExpiresAt) {
        return {
          success: false,
          code: 'CALL_RECOVERY_IN_PROGRESS',
        };
      }

      const now = new Date();

      const isInitial = data.type === CallNegotiationType.INITIAL;

      if (isInitial) {
        if (
          !isCaller ||
          !call.calleeConnectionId ||
          call.status !== CallStatus.ACCEPTED ||
          !call.connectionExpiresAt ||
          call.connectionExpiresAt.getTime() <= now.getTime()
        ) {
          return {
            success: false,
            code: 'CALL_NEGOTIATION_NOT_ALLOWED',
          };
        }
      } else if (call.status !== CallStatus.CONNECTED) {
        return {
          success: false,
          code: 'CALL_NEGOTIATION_NOT_ALLOWED',
        };
      }

      const active = await repository.findOne({
        where: {
          callId: call.id,
          status: In(ACTIVE_STATUSES),
        },
      });

      if (active) {
        return {
          success: false,
          code: 'CALL_NEGOTIATION_IN_PROGRESS',
        };
      }

      if (isInitial) {
        const previousInitial = await repository.findOne({
          where: {
            callId: call.id,
            type: CallNegotiationType.INITIAL,
          },
        });

        if (previousInitial) {
          return {
            success: false,
            code: 'CALL_INITIAL_NEGOTIATION_EXISTS',
          };
        }
      }

      const requestedDeadline = now.getTime() + data.timeoutMs;

      const deadline =
        isInitial && call.connectionExpiresAt
          ? Math.min(requestedDeadline, call.connectionExpiresAt.getTime())
          : requestedDeadline;

      const negotiation = repository.create({
        requestId: data.requestId,
        callId: call.id,
        offererId: data.userId,
        type: data.type,
        status: CallNegotiationStatus.PENDING,
        offerHash: null,
        answerHash: null,
        offerAcknowledgedAt: null,
        answerAcknowledgedAt: null,
        callerRecoveredAt: null,
        calleeRecoveredAt: null,
        recoveredAt: null,
        expiresAt: new Date(deadline),
        endedAt: null,
      });

      const saved = await repository.save(negotiation);

      call.currentNegotiationId = saved.id;

      if (data.type === CallNegotiationType.ICE_RESTART) {
        call.recoveryExpiresAt = new Date(now.getTime() + CALL_RECOVERY_TIMEOUT_MS);
      }

      await callRepository.save(call);

      return {
        success: true,
        negotiation: saved,
        created: true,
        recoveryExpiresAt: call.recoveryExpiresAt,
      };
    });
  },

  async processSignal(data: SignalData) {
    return this.manager.transaction('READ COMMITTED', async (manager) => {
      const callRepository = manager.getRepository(Call);
      const repository = manager.getRepository(CallNegotiation);

      // Keep the same lock order: call, then negotiation.
      const call = await callRepository.findOne({
        where: {
          id: data.callId,
          status: In([CallStatus.ACCEPTED, CallStatus.CONNECTED]),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!call || !call.calleeConnectionId || call.currentNegotiationId !== data.negotiationId) {
        return null;
      }

      const isCaller =
        call.callerId === data.userId && call.callerConnectionId === data.connectionId;

      const isCallee =
        call.calleeId === data.userId && call.calleeConnectionId === data.connectionId;

      if (!isCaller && !isCallee) {
        return null;
      }

      const negotiation = await repository.findOne({
        where: {
          id: data.negotiationId,
          callId: call.id,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!negotiation) {
        return null;
      }

      const completed = negotiation.status === CallNegotiationStatus.COMPLETED;

      const active = ACTIVE_STATUSES.includes(negotiation.status);

      if (!active && !completed) {
        return null;
      }

      const now = new Date();

      if (active && negotiation.expiresAt.getTime() <= now.getTime()) {
        return null;
      }

      if (
        call.status === CallStatus.ACCEPTED &&
        (!call.connectionExpiresAt || call.connectionExpiresAt.getTime() <= now.getTime())
      ) {
        return null;
      }

      if (call.recoveryExpiresAt && call.recoveryExpiresAt.getTime() <= now.getTime()) {
        return null;
      }

      const isOfferer = negotiation.offererId === data.userId;

      let dirty = false;
      let becameCompleted = false;

      switch (data.action.kind) {
        case 'offer': {
          if (!isOfferer) {
            return null;
          }

          if (negotiation.offerHash !== null) {
            if (negotiation.offerHash !== data.action.signalId) {
              return null;
            }
          } else {
            if (negotiation.status !== CallNegotiationStatus.PENDING) {
              return null;
            }

            negotiation.offerHash = data.action.signalId;
            negotiation.status = CallNegotiationStatus.OFFERED;
            dirty = true;
          }

          break;
        }

        case 'answer': {
          if (isOfferer || !negotiation.offerHash) {
            return null;
          }

          if (negotiation.answerHash !== null) {
            if (negotiation.answerHash !== data.action.signalId) {
              return null;
            }
          } else {
            if (negotiation.status !== CallNegotiationStatus.OFFERED) {
              return null;
            }

            negotiation.answerHash = data.action.signalId;
            negotiation.status = CallNegotiationStatus.ANSWERED;
            dirty = true;
          }

          break;
        }

        case 'ack': {
          const acknowledgesOffer = data.action.signalType === 'CALL_OFFER';

          if ((acknowledgesOffer && isOfferer) || (!acknowledgesOffer && !isOfferer)) {
            return null;
          }

          const expectedHash = acknowledgesOffer ? negotiation.offerHash : negotiation.answerHash;

          if (!expectedHash || expectedHash !== data.action.signalId) {
            return null;
          }

          if (acknowledgesOffer) {
            if (!negotiation.offerAcknowledgedAt) {
              negotiation.offerAcknowledgedAt = now;
              dirty = true;
            }
          } else if (!negotiation.answerAcknowledgedAt) {
            negotiation.answerAcknowledgedAt = now;
            dirty = true;
          }

          if (!completed && negotiation.offerAcknowledgedAt && negotiation.answerAcknowledgedAt) {
            negotiation.status = CallNegotiationStatus.COMPLETED;
            negotiation.endedAt = now;
            becameCompleted = true;
            dirty = true;
          }

          break;
        }

        case 'ice':
          break;
      }

      if (dirty) {
        await repository.save(negotiation);
      }

      return {
        call,
        negotiation,
        becameCompleted,
        receiverId: isCaller ? call.calleeId : call.callerId,
        receiverConnectionId: isCaller ? call.calleeConnectionId : call.callerConnectionId,
      };
    });
  },

  async reportRecovered(
    callId: string,
    negotiationId: string,
    userId: string,
    connectionId: string
  ) {
    return this.manager.transaction(async (manager) => {
      const callRepository = manager.getRepository(Call);
      const repository = manager.getRepository(CallNegotiation);

      const call = await callRepository.findOne({
        where: {
          id: callId,
          status: CallStatus.CONNECTED,
          currentNegotiationId: negotiationId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!call) {
        return null;
      }

      const isCaller = call.callerId === userId && call.callerConnectionId === connectionId;

      const isCallee = call.calleeId === userId && call.calleeConnectionId === connectionId;

      if (!isCaller && !isCallee) {
        return null;
      }

      const negotiation = await repository.findOne({
        where: {
          id: negotiationId,
          callId,
          type: CallNegotiationType.ICE_RESTART,
          status: CallNegotiationStatus.COMPLETED,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!negotiation) {
        return null;
      }

      if (negotiation.recoveredAt) {
        return {
          call,
          negotiation,
          becameRecovered: false,
        };
      }

      const now = new Date();

      if (!call.recoveryExpiresAt || call.recoveryExpiresAt.getTime() <= now.getTime()) {
        return null;
      }

      if (isCaller) {
        if (negotiation.callerRecoveredAt) {
          return {
            call,
            negotiation,
            becameRecovered: false,
          };
        }

        negotiation.callerRecoveredAt = now;
      } else {
        if (negotiation.calleeRecoveredAt) {
          return {
            call,
            negotiation,
            becameRecovered: false,
          };
        }

        negotiation.calleeRecoveredAt = now;
      }

      const becameRecovered = Boolean(
        negotiation.callerRecoveredAt && negotiation.calleeRecoveredAt
      );

      if (becameRecovered) {
        negotiation.recoveredAt = now;
        call.recoveryExpiresAt = null;

        await callRepository.save(call);
      }

      await repository.save(negotiation);

      return {
        call,
        negotiation,
        becameRecovered,
      };
    });
  },

  async cancelPendingForCall(manager: EntityManager, callId: string) {
    // The caller already holds the call row lock.
    await manager.getRepository(CallNegotiation).update(
      {
        callId,
        status: In(ACTIVE_STATUSES),
      },
      {
        status: CallNegotiationStatus.CANCELLED,
        endedAt: new Date(),
      }
    );
  },

  async expirePending() {
    const candidates = await this.find({
      where: {
        status: In(ACTIVE_STATUSES),
        expiresAt: LessThanOrEqual(new Date()),
      },
      select: {
        id: true,
        callId: true,
      },
      order: {
        expiresAt: 'ASC',
        id: 'ASC',
      },
    });

    const results: ExpirationResult[] = [];

    for (const candidate of candidates) {
      const result = await this.manager.transaction(async (manager) => {
        const call = await manager.getRepository(Call).findOne({
          where: { id: candidate.callId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!call) {
          return null;
        }

        const repository = manager.getRepository(CallNegotiation);

        const negotiation = await repository.findOne({
          where: {
            id: candidate.id,
            callId: call.id,
            status: In(ACTIVE_STATUSES),
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!negotiation) {
          return null;
        }

        const now = new Date();

        const callIsActive =
          call.status === CallStatus.ACCEPTED || call.status === CallStatus.CONNECTED;

        if (callIsActive && negotiation.expiresAt.getTime() > now.getTime()) {
          return null;
        }

        negotiation.status = callIsActive
          ? CallNegotiationStatus.EXPIRED
          : CallNegotiationStatus.CANCELLED;

        negotiation.endedAt = now;

        await repository.save(negotiation);

        return {
          callId: call.id,
          negotiationId: negotiation.id,
          type: negotiation.type,
          status: negotiation.status,
          endedAt: now,
          callerId: call.callerId,
          calleeId: call.calleeId,
          callerConnectionId: call.callerConnectionId,
          calleeConnectionId: call.calleeConnectionId,
        };
      });

      if (result) {
        results.push(result);
      }
    }

    return results;
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
});
