import { createEventDispatcher } from './dispatcher';
import { WS_CLIENT_EVENTS } from '@constants';
import { PrivateMessageDto, MessageDeliveryDto } from '@dtos';
import { privateMessageHandler, messageDeliveryHandler } from './handlers';

/**
 * Registers all WebSocket event handlers.
 */
export function registerEventHandlers() {
  const dispatcher = createEventDispatcher();

  dispatcher.register<PrivateMessageDto>(
    WS_CLIENT_EVENTS.SEND_PRIVATE_MESSAGE,
    privateMessageHandler
  );

  dispatcher.register<MessageDeliveryDto>(
    WS_CLIENT_EVENTS.MESSAGE_DELIVERED,
    messageDeliveryHandler
  );

  dispatcher.register<MessageDeliveryDto>(WS_CLIENT_EVENTS.MESSAGE_READ, messageDeliveryHandler);

  return dispatcher;
}
