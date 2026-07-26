/* eslint-disable @typescript-eslint/no-explicit-any */
import cookieParser from 'cookie-parser';
import { IncomingMessage } from 'node:http';

const parser = cookieParser();

export function parseWebSocketCookies(request: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    parser(request as any, {} as any, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve((request as any).cookies ?? {});
    });
  });
}
