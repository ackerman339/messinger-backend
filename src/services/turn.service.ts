import { createHmac } from 'node:crypto';
import { env } from '@config/environment';

class TurnService {
  generateCredentials(userId: string) {
    const expiration = Math.floor(Date.now() / 1000) + env.TURN_TTL;

    // Coturn REST API username format: timestamp:identifier
    const username = `${expiration}:${userId}`;

    // Generate HMAC-SHA1 using the shared TURN secret
    const credential = createHmac('sha1', env.TURN_SECRET).update(username).digest('base64');

    return {
      iceServers: [
        {
          urls: `stun:${env.TURN_HOST}:${env.TURN_PORT}`,
        },
        {
          urls: `turn:${env.TURN_HOST}:${env.TURN_PORT}?transport=udp`,
          username,
          credential,
        },
      ],
      ttl: env.TURN_TTL,
    };
  }
}

export const turnService = new TurnService();
