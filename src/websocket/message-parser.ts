import { RawData } from 'ws';
import { WsClientMessage } from '@appTypes';

/**
 * Parses a raw WebSocket message into a structured message.
 *
 * Throws a SyntaxError if the payload is not valid JSON.
 */
export function parseWsMessage(rawMessage: RawData): WsClientMessage {
  return JSON.parse(rawMessage.toString()) as WsClientMessage;
}
