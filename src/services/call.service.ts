import { ForbiddenException, NotFoundException } from '@exceptions';
import { CallMedia } from '@appTypes';
import { CallInitDto } from '@dtos';
import { CallRepository, UserRepository } from '@repositories';

export class CallService {
  async init(callerId: string, callerConnectionId: string, { calleeId, media }: CallInitDto) {
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
      callerConnectionId,
      media: media === 'audio' ? CallMedia.AUDIO : CallMedia.VIDEO,
    });

    if (!call) {
      throw new ForbiddenException('CALL_PARTICIPANT_BUSY');
    }

    return call;
  }

  async accept(userId: string, connectionId: string, callId: string) {
    const call = await CallRepository.acceptIfRinging(callId, userId, connectionId);

    if (!call) {
      throw new ForbiddenException('CALL_NOT_ACCEPTABLE');
    }

    return call;
  }

  async reject(userId: string, callId: string) {
    const call = await CallRepository.rejectIfRinging(callId, userId);

    if (!call) {
      throw new ForbiddenException('CALL_NOT_REJECTABLE');
    }

    return call;
  }

  async end(userId: string, callId: string) {
    const call = await CallRepository.endIfAllowed(callId, userId);

    if (!call) {
      throw new ForbiddenException('CALL_NOT_ENDABLE');
    }

    return call;
  }

  async offer(userId: string, connectionId: string, callId: string) {
    const call = await CallRepository.findAcceptedForOffer(callId, userId, connectionId);

    if (!call || !call.calleeConnectionId) {
      throw new ForbiddenException('CALL_OFFER_NOT_ALLOWED');
    }

    return {
      callId: call.id,
      receiverId: call.calleeId,
      receiverConnectionId: call.calleeConnectionId,
    };
  }

  async answer(userId: string, connectionId: string, callId: string) {
    const call = await CallRepository.findAcceptedForAnswer(callId, userId, connectionId);

    if (!call) {
      throw new ForbiddenException('CALL_ANSWER_NOT_ALLOWED');
    }

    return {
      callId: call.id,
      receiverId: call.callerId,
      receiverConnectionId: call.callerConnectionId,
    };
  }

  async iceCandidate(userId: string, connectionId: string, callId: string) {
    const call = await CallRepository.findAcceptedForIceCandidate(callId, userId, connectionId);

    if (!call || !call.calleeConnectionId) {
      throw new ForbiddenException('CALL_ICE_CANDIDATE_NOT_ALLOWED');
    }

    const isCaller = call.callerId === userId;

    return {
      callId: call.id,
      receiverId: isCaller ? call.calleeId : call.callerId,
      receiverConnectionId: isCaller ? call.calleeConnectionId : call.callerConnectionId,
    };
  }
}

export const callService = new CallService();
