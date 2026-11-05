import { In } from 'typeorm';
import { AppDataSource } from '@config/database';
import { CallStatus } from '@appTypes';
import { Call } from '@entities';

type CreateCallData = Pick<Call, 'callerId' | 'calleeId' | 'media' | 'callerConnectionId'>;

export const CallRepository = AppDataSource.getRepository(Call).extend({
  async createIfParticipantsAvailable(data: CreateCallData) {
    return this.manager.transaction('READ COMMITTED', async (manager) => {
      const participantIds = [data.callerId, data.calleeId].sort();

      // Lock call creation for each participant without locking user rows.
      for (const userId of participantIds) {
        await manager.query(
          `SELECT pg_advisory_xact_lock(
            hashtextextended($1::text, 0)
          )`,
          [`call:user:${userId}`]
        );
      }

      const repository = manager.getRepository(Call);

      const activeStatuses = [CallStatus.RINGING, CallStatus.ACCEPTED];

      // A participant is busy as either caller or callee.
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
      });

      return repository.save(call);
    });
  },

  async acceptIfRinging(callId: string, calleeId: string, calleeConnectionId: string) {
    return this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Call);

      const result = await repository.update(
        {
          id: callId,
          calleeId,
          status: CallStatus.RINGING,
        },
        {
          status: CallStatus.ACCEPTED,
          calleeConnectionId,
          acceptedAt: new Date(),
        }
      );

      if (result.affected !== 1) {
        return null;
      }

      return repository.findOneByOrFail({ id: callId });
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
        }
      );

      if (result.affected !== 1) {
        return null;
      }

      return repository.findOneByOrFail({ id: callId });
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
        }
      );

      if (result.affected !== 1) {
        return null;
      }

      return repository.findOneByOrFail({ id: callId });
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
});
