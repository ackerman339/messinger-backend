import { In } from 'typeorm';
import { AppDataSource } from '@config/database';
import { CallStatus } from '@appTypes';
import { Call } from '@entities';

type CreateCallData = Pick<Call, 'callerId' | 'calleeId' | 'media'>;

export const CallRepository = AppDataSource.getRepository(Call).extend({
  async createIfParticipantsAvailable(data: CreateCallData) {
    return this.manager.transaction('READ COMMITTED', async (manager) => {
      const participantIds = [data.callerId, data.calleeId].sort();

      // Lock call creation for each participant.
      // These locks do not lock user rows.
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
        status: CallStatus.RINGING,
        acceptedAt: null,
        endedAt: null,
      });

      return repository.save(call);
    });
  },
});
