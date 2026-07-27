import { createEventDispatcher } from './dispatcher';
import { WS_CLIENT_EVENTS } from '@constants';
import { SendMessageWsDto } from '@dtos';
import { sendMessageHandler } from './handlers';

/**
 * Registers all WebSocket event handlers.
 */
export function registerEventHandlers() {
  const dispatcher = createEventDispatcher();

  dispatcher.register<SendMessageWsDto>(WS_CLIENT_EVENTS.SEND_MESSAGE, sendMessageHandler);

  return dispatcher;
}
