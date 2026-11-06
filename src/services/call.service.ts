import { ForbiddenException, NotFoundException } from '@exceptions';
import { CallMedia, CallStatus } from '@appTypes';
import { CallInitDto, CallSyncDto } from '@dtos';
import { CallRepository, UserRepository } from '@repositories';

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

    if (
      call.callerId !== callerId ||
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

  async timeout(userId: string, connectionId: string, callId: string) {
    const call = await CallRepository.timeoutIfExpired(callId, userId, connectionId);

    if (call) {
      return call;
    }

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

  async connected(userId: string, connectionId: string, callId: string) {
    const result = await CallRepository.reportConnected(callId, userId, connectionId);

    if (!result) {
      throw new ForbiddenException('CALL_CONNECTED_NOT_ALLOWED');
    }

    return result;
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

  async expireRinging() {
    const calls = await CallRepository.expireRinging();

    return calls.map((call) => ({
      callId: call.id,
      callerId: call.caller_id,
      calleeId: call.callee_id,
      endedAt: call.ended_at,
    }));
  }

  async expireConnecting() {
    const calls = await CallRepository.expireConnecting();

    return calls.map((call) => ({
      callId: call.id,
      callerId: call.caller_id,
      calleeId: call.callee_id,
      endedAt: call.ended_at,
    }));
  }

  async expireRecovery() {
    const calls = await CallRepository.expireRecovery();

    return calls.map((call) => ({
      callId: call.id,
      callerId: call.caller_id,
      calleeId: call.callee_id,
      endedAt: call.ended_at,
    }));
  }

  async sync(userId: string, connectionId: string, { callId, requestId }: CallSyncDto) {
    const result = await CallRepository.findStateForParticipant(userId, {
      callId,
      requestId,
    });

    if (!result) {
      throw new NotFoundException('CALL_NOT_FOUND');
    }

    const { call, negotiation } = result;
    const isCaller = call.callerId === userId;
    const selectedConnectionId = isCaller ? call.callerConnectionId : call.calleeConnectionId;
    const isSelectedConnection = selectedConnectionId === connectionId;

    const isTerminal = [
      CallStatus.REJECTED,
      CallStatus.MISSED,
      CallStatus.ENDED,
      CallStatus.FAILED,
    ].includes(call.status);

    return {
      call: {
        callId: call.id,
        requestId: call.requestId,
        callerId: call.callerId,
        calleeId: call.calleeId,
        media: call.media,
        status: call.status,
        role: isCaller ? 'CALLER' : 'CALLEE',
        isSelectedConnection,
        isTerminal,
        createdAt: call.createdAt,
        acceptedAt: call.acceptedAt,
        connectedAt: call.connectedAt,
        callerConnectedAt: call.callerConnectedAt,
        calleeConnectedAt: call.calleeConnectedAt,
        endedAt: call.endedAt,
        expiresAt: call.expiresAt,
        connectionExpiresAt: call.connectionExpiresAt,
        recoveryExpiresAt: call.recoveryExpiresAt,
        currentNegotiationId: call.currentNegotiationId,
      },
      negotiation: negotiation
        ? {
            negotiationId: negotiation.id,
            requestId: negotiation.requestId,
            type: negotiation.type,
            status: negotiation.status,
            offererId: negotiation.offererId,
            isOfferer: negotiation.offererId === userId,
            offerSignalId: negotiation.offerHash,
            answerSignalId: negotiation.answerHash,
            offerAcknowledgedAt: negotiation.offerAcknowledgedAt,
            answerAcknowledgedAt: negotiation.answerAcknowledgedAt,
            callerRecoveredAt: negotiation.callerRecoveredAt,
            calleeRecoveredAt: negotiation.calleeRecoveredAt,
            recoveredAt: negotiation.recoveredAt,
            createdAt: negotiation.createdAt,
            expiresAt: negotiation.expiresAt,
            endedAt: negotiation.endedAt,
          }
        : null,
    };
  }

  async reconcileAfterRestart() {
    return CallRepository.reconcileAfterRestart();
  }
}

export const callService = new CallService();
