import { WsHandlers } from '@appTypes';
import { CallReferenceDto, CallReferenceSchema } from '@dtos';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { notifyCallNoAnswer } from './notify-call-no-answer';

export async function callTimeoutHandler({ connection, message }: WsHandlers<CallReferenceDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { callId } = CallReferenceSchema.parse(message.data);

  const expiredCall = await callService.timeout(userId, connection.id, callId);

  if (!expiredCall) {
    // Already marked as MISSED; no new transition to notify.
    return;
  }

  notifyCallNoAnswer({
    callId: expiredCall.id,
    callerId: expiredCall.callerId,
    callerName: expiredCall.caller?.username ?? null,
    calleeId: expiredCall.calleeId,
    endedAt: expiredCall.endedAt,
  });
}
