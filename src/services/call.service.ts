import { ForbiddenException, NotFoundException } from '@exceptions';
import { CallMedia, CallStatus } from '@appTypes';
import { WS_CLIENT_EVENTS } from '@constants';
import { CallInitDto, CallSignalAckDto } from '@dtos';
import { CallRepository, UserRepository } from '@repositories';
import { createHash } from 'node:crypto';

export class CallService {
  async init(
    callerId: string,
    callerConnectionId: string,
    { calleeId, media, requestId }: CallInitDto
  ) {
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

    const callMedia = media === 'audio' ? CallMedia.AUDIO : CallMedia.VIDEO;

    const result = await CallRepository.createIfParticipantsAvailable({
      callerId,
      calleeId,
      callerConnectionId,
      requestId,
      media: callMedia,
    });

    if (!result) {
      throw new ForbiddenException('CALL_PARTICIPANT_BUSY');
    }

    const { call } = result;

    // A request ID cannot be reused with different parameters.
    if (
      call.calleeId !== calleeId ||
      call.media !== callMedia ||
      call.callerConnectionId !== callerConnectionId
    ) {
      throw new ForbiddenException('CALL_REQUEST_CONFLICT');
    }

    return result;
  }

  async accept(userId: string, connectionId: string, callId: string) {
    const result = await CallRepository.acceptIfRinging(callId, userId, connectionId);

    if (!result) {
      throw new ForbiddenException('CALL_NOT_ACCEPTABLE');
    }

    return result;
  }

  async reject(userId: string, callId: string) {
    const result = await CallRepository.rejectIfRinging(callId, userId);

    if (!result) {
      throw new ForbiddenException('CALL_NOT_REJECTABLE');
    }

    return result;
  }

  async end(userId: string, callId: string) {
    const result = await CallRepository.endIfAllowed(callId, userId);

    if (!result) {
      throw new ForbiddenException('CALL_NOT_ENDABLE');
    }

    return result;
  }

  async offer(userId: string, connectionId: string, callId: string, sdp: string) {
    const signalId = createHash('sha256').update(sdp, 'utf8').digest('hex');

    const call = await CallRepository.registerOffer(callId, userId, connectionId, signalId);

    if (!call || !call.calleeConnectionId) {
      throw new ForbiddenException('CALL_OFFER_NOT_ALLOWED');
    }

    return {
      callId: call.id,
      receiverId: call.calleeId,
      receiverConnectionId: call.calleeConnectionId,
      signalId,
    };
  }

  async answer(userId: string, connectionId: string, callId: string, sdp: string) {
    const signalId = createHash('sha256').update(sdp, 'utf8').digest('hex');

    const call = await CallRepository.registerAnswer(callId, userId, connectionId, signalId);

    if (!call) {
      throw new ForbiddenException('CALL_ANSWER_NOT_ALLOWED');
    }

    return {
      callId: call.id,
      receiverId: call.callerId,
      receiverConnectionId: call.callerConnectionId,
      signalId,
    };
  }

  async acknowledgeSignal(userId: string, connectionId: string, data: CallSignalAckDto) {
    const call = await CallRepository.findForSignalAck(userId, connectionId, data);

    if (!call || !call.calleeConnectionId) {
      throw new ForbiddenException('CALL_SIGNAL_ACK_NOT_ALLOWED');
    }

    const acknowledgesOffer = data.signalType === WS_CLIENT_EVENTS.CALL_OFFER;

    return {
      callId: call.id,
      signalType: data.signalType,
      signalId: data.signalId,
      receiverId: acknowledgesOffer ? call.callerId : call.calleeId,
      receiverConnectionId: acknowledgesOffer ? call.callerConnectionId : call.calleeConnectionId,
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

  async timeout(userId: string, connectionId: string, callId: string) {
    const call = await CallRepository.timeoutIfExpired(callId, userId, connectionId);

    if (!call) {
      // The cron or another request may have already closed the call.
      const missedCall = await CallRepository.findOne({
        where: {
          id: callId,
          callerId: userId,
          callerConnectionId: connectionId,
          status: CallStatus.MISSED,
        },
      });

      if (missedCall) {
        return null;
      }

      throw new ForbiddenException('CALL_TIMEOUT_NOT_ALLOWED');
    }

    return call;
  }

  async expireRinging() {
    const calls = await CallRepository.expireRinging();

    return calls.map((call) => ({
      callId: call.id,
      callerId: call.caller_id,
      calleeId: call.callee_id,
      endedAt: call.ended_at,
    }));
  }

  async disconnect(userId: string, connectionId: string) {
    const calls = await CallRepository.endByDisconnectedConnection(userId, connectionId);

    return calls.map((call) => ({
      callId: call.id,
      callerId: call.caller_id,
      calleeId: call.callee_id,
      endedAt: call.ended_at,
    }));
  }
}

export const callService = new CallService();
