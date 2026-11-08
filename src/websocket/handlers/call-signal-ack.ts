import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallSignalAckDto, CallSignalAckSchema } from '@dtos';
import { callNegotiationService } from '@services';

import { resolveCallSignalReceiver } from './foward-call-signal';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function callSignalAckHandler({ connection, message }: WsHandlers<CallSignalAckDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const data = CallSignalAckSchema.parse(message.data);
  const route = await callNegotiationService.acknowledgeSignal(userId, connection.id, data);
  const receiver = await resolveCallSignalReceiver(connection, userId, route);

  if (!receiver) {
    return;
  }

  sendMessage(receiver, {
    type: WS_SERVER_EVENTS.CALL_SIGNAL_ACK,
    data: {
      callId: route.callId,
      negotiationId: route.negotiationId,
      signalType: route.signalType,
      signalId: route.signalId,
    },
  });

  if (!route.becameCompleted) {
    return;
  }

  const participants = [
    {
      userId: route.callerId,
      connectionId: route.callerConnectionId,
    },
    {
      userId: route.calleeId,
      connectionId: route.calleeConnectionId,
    },
  ];

  for (const participant of participants) {
    const selectedConnection = connectionManager
      .getUserConnections(participant.userId)
      .find((candidate) => candidate.id === participant.connectionId);

    if (selectedConnection) {
      sendMessage(selectedConnection, {
        type: WS_SERVER_EVENTS.CALL_NEGOTIATION_COMPLETED,
        data: {
          callId: route.callId,
          negotiationId: route.negotiationId,
          status: route.status,
        },
      });
    }
  }
}
