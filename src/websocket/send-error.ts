import { Connection } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { BaseException } from '@exceptions';
import { sendMessage } from './send-message';

/**
 * Converts internal errors into safe WebSocket error codes.
 */
function getErrorInfo(error: unknown) {
  if (error instanceof BaseException) {
    return {
      ...error.toJSON(),
    };
  }

  return 'UNHANDLED_WS_ERROR';
}

/**
 * Sends a standardized error message through a WebSocket connection.
 */
export function sendError(connection: Connection, error: unknown): void {
  const data = getErrorInfo(error);

  sendMessage(connection, {
    type: WS_SERVER_EVENTS.ERROR,
    data,
  });
}
