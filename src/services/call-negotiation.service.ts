import { createHash } from 'node:crypto';
import { CALL_NEGOTIATION_TIMEOUT_MS } from '@constants';
import { ForbiddenException } from '@exceptions';
import { CallNegotiationRepository } from '@repositories';
import {
  CallIceCandidateDto,
  CallNegotiationInitDto,
  CallRecoveredDto,
  CallSdpDto,
  CallSignalAckDto,
} from '@dtos';

type SignalResult = NonNullable<
  Awaited<ReturnType<typeof CallNegotiationRepository.processSignal>>
>;

export class CallNegotiationService {
  async init(userId: string, connectionId: string, data: CallNegotiationInitDto) {
    const result = await CallNegotiationRepository.createIfAvailable({
      ...data,
      userId,
      connectionId,
      timeoutMs: CALL_NEGOTIATION_TIMEOUT_MS,
    });

    if (!result.success) {
      throw new ForbiddenException(result.code);
    }

    return {
      negotiation: result.negotiation,
      created: result.created,
      recoveryExpiresAt: result.recoveryExpiresAt,
    };
  }

  async offer(userId: string, connectionId: string, data: CallSdpDto) {
    const signalId = this.hashSdp(data.sdp);

    const result = await CallNegotiationRepository.processSignal({
      callId: data.callId,
      negotiationId: data.negotiationId,
      userId,
      connectionId,
      action: { kind: 'offer', signalId },
    });

    if (!result) {
      throw new ForbiddenException('CALL_OFFER_NOT_ALLOWED');
    }

    return {
      ...this.getRoute(result),
      signalId,
    };
  }

  async answer(userId: string, connectionId: string, data: CallSdpDto) {
    const signalId = this.hashSdp(data.sdp);

    const result = await CallNegotiationRepository.processSignal({
      callId: data.callId,
      negotiationId: data.negotiationId,
      userId,
      connectionId,
      action: { kind: 'answer', signalId },
    });

    if (!result) {
      throw new ForbiddenException('CALL_ANSWER_NOT_ALLOWED');
    }

    return {
      ...this.getRoute(result),
      signalId,
    };
  }

  async acknowledgeSignal(userId: string, connectionId: string, data: CallSignalAckDto) {
    const result = await CallNegotiationRepository.processSignal({
      callId: data.callId,
      negotiationId: data.negotiationId,
      userId,
      connectionId,
      action: {
        kind: 'ack',
        signalType: data.signalType,
        signalId: data.signalId,
      },
    });

    if (!result) {
      throw new ForbiddenException('CALL_SIGNAL_ACK_NOT_ALLOWED');
    }

    return {
      ...this.getRoute(result),
      signalType: data.signalType,
      signalId: data.signalId,
    };
  }

  async iceCandidate(userId: string, connectionId: string, data: CallIceCandidateDto) {
    const result = await CallNegotiationRepository.processSignal({
      callId: data.callId,
      negotiationId: data.negotiationId,
      userId,
      connectionId,
      action: { kind: 'ice' },
    });

    if (!result) {
      throw new ForbiddenException('CALL_ICE_CANDIDATE_NOT_ALLOWED');
    }

    return this.getRoute(result);
  }

  async recovered(
    userId: string,
    connectionId: string,
    { callId, negotiationId }: CallRecoveredDto
  ) {
    const result = await CallNegotiationRepository.reportRecovered(
      callId,
      negotiationId,
      userId,
      connectionId
    );

    if (!result) {
      throw new ForbiddenException('CALL_RECOVERY_NOT_ALLOWED');
    }

    return result;
  }

  async expirePending() {
    return CallNegotiationRepository.expirePending();
  }

  private hashSdp(sdp: string) {
    return createHash('sha256').update(sdp, 'utf8').digest('hex');
  }

  private getRoute(result: SignalResult) {
    return {
      callId: result.call.id,
      negotiationId: result.negotiation.id,
      negotiationType: result.negotiation.type,
      offererId: result.negotiation.offererId,
      status: result.negotiation.status,
      becameCompleted: result.becameCompleted,
      receiverId: result.receiverId,
      receiverConnectionId: result.receiverConnectionId,
      callerId: result.call.callerId,
      calleeId: result.call.calleeId,
      callerConnectionId: result.call.callerConnectionId,
      calleeConnectionId: result.call.calleeConnectionId,
      recoveryExpiresAt: result.call.recoveryExpiresAt,
    };
  }
}

export const callNegotiationService = new CallNegotiationService();
