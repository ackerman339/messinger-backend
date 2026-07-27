import { createEventDispatcher } from './dispatcher';

/**
 * Registers all WebSocket event handlers.
 */
export function registerEventHandlers() {
  const dispatcher = createEventDispatcher();

  return dispatcher;
}
