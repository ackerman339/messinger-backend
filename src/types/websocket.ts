import { WebSocket } from 'ws';
import { WS_CLIENT_EVENTS, WS_SERVER_EVENTS } from '@constants';

export interface Connection {
  id: string;
  socket: WebSocket;
  connectedAt: Date;
  userId: string | null;
  sessionId: string | null;
}

export interface WsClientMessage<T = unknown> {
  type: WsClientEvent;
  requestId?: string;
  data: T;
}

export interface WsServerMessage<T = unknown> {
  type: WsServerEvent;
  requestId?: string;
  data: T;
}

export type WsHandlers<T> = {
  connection: Connection;
  message: WsClientMessage<T>;
};

export type WsClientEvent = (typeof WS_CLIENT_EVENTS)[keyof typeof WS_CLIENT_EVENTS];
export type WsServerEvent = (typeof WS_SERVER_EVENTS)[keyof typeof WS_SERVER_EVENTS];
