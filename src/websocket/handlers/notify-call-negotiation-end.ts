import { CallNegotiationStatus, CallNegotiationType } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';

import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

type NegotiationEndData = {
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

export function notifyCallNegotiationEnd(negotiation: NegotiationEndData) {
  const participants = [
    {
      userId: negotiation.callerId,
      connectionId: negotiation.callerConnectionId,
    },
    {
      userId: negotiation.calleeId,
      connectionId: negotiation.calleeConnectionId,
    },
  ];

  for (const participant of participants) {
    const connection = connectionManager
      .getUserConnections(participant.userId)
      .find((candidate) => candidate.id === participant.connectionId);

    if (!connection) {
      continue;
    }

    sendMessage(connection, {
      type: WS_SERVER_EVENTS.CALL_NEGOTIATION_END,
      data: {
        callId: negotiation.callId,
        negotiationId: negotiation.negotiationId,
        type: negotiation.type,
        status: negotiation.status,
        endedAt: negotiation.endedAt,
        reason:
          negotiation.status === CallNegotiationStatus.EXPIRED
            ? 'NEGOTIATION_TIMEOUT'
            : 'CALL_TERMINATED',
      },
    });
  }
}
