import { ForbiddenException, NotFoundException } from '@exceptions';
import { CallMedia } from '@appTypes';
import { CallInitDto } from '@dtos';
import { CallRepository, UserRepository } from '@repositories';

export class CallService {
  async init(callerId: string, { calleeId, media }: CallInitDto) {
    if (callerId === calleeId) {
      throw new ForbiddenException('CALL_SELF_NOT_ALLOWED');
    }

    const callee = await UserRepository.findOne({
      where: { id: calleeId },
      select: { id: true },
    });

    if (!callee) {
      throw new NotFoundException('CALL_CALLEE_NOT_FOUND');
    }

    const call = await CallRepository.createIfParticipantsAvailable({
      callerId,
      calleeId,
      media: media === 'audio' ? CallMedia.AUDIO : CallMedia.VIDEO,
    });

    if (!call) {
      throw new ForbiddenException('CALL_PARTICIPANT_BUSY');
    }

    return call;
  }
}

export const callService = new CallService();
