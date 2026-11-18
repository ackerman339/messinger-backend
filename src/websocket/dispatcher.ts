import { ZodError } from 'zod';
import { WsClientMessage, WsClientEvent, Connection } from '@appTypes';
import { ValidationException, ValidationError } from '@exceptions';
import { sendError } from './send-error';
import { sendMessage } from './send-message';
import { WS_CLIENT_EVENTS, WS_SERVER_EVENTS } from '@constants';

type EventHandler<T = unknown> = (params: {
  connection: Connection;
  message: WsClientMessage<T>;
}) => Promise<void>;

/**
 * Routes parsed WebSocket messages to their corresponding handlers.
 *
 * Responsibilities:
 * - Resolve the appropriate handler.
 * - Execute the handler.
 *
 * This component is intentionally unaware of transport,
 * serialization, authentication and business logic.
 */
export function createEventDispatcher() {
  const handlers = new Map<WsClientEvent, EventHandler>();

  function register<T>(event: WsClientEvent, handler: EventHandler<T>) {
    handlers.set(event, handler as EventHandler);
  }

  async function dispatch(connection: Connection, message: WsClientMessage) {
    const handler = handlers.get(message.type);

    if (!handler) {
      return;
    }

    try {
      await handler({
        connection,
        message,
      });
      if (
        message.requestId &&
        (message.type === WS_CLIENT_EVENTS.GROUP_INVITE_MEMBER ||
          message.type === WS_CLIENT_EVENTS.GROUP_INVITATION_ACCEPT ||
          message.type === WS_CLIENT_EVENTS.GROUP_INVITATION_REJECT)
      ) {
        sendMessage(connection, {
          type: WS_SERVER_EVENTS.GROUP_ACTION_CONFIRMED,
          requestId: message.requestId,
          data: { event: message.type },
        });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: ValidationError[] = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          value: err.path,
        }));

        sendError(
          connection,
          new ValidationException('INVALID_WS_MESSAGE_PAYLOAD', formattedErrors),
          message.requestId
        );

        return;
      }

      sendError(connection, error, message.requestId);
    }
  }

  return {
    register,
    dispatch,
  };
}
