import { ZodError } from 'zod';
import { WsClientMessage, WsClientEvent, Connection } from '@appTypes';
import { ValidationException, ValidationError } from '@exceptions';
import { sendError } from './send-error';

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
          new ValidationException('INVALID_WS_MESSAGE_PAYLOAD', formattedErrors)
        );

        return;
      }

      sendError(connection, error);
    }
  }

  return {
    register,
    dispatch,
  };
}
