import { Connection } from '@appTypes';
import { UnauthorizedException } from '@exceptions';

export function requireAuthentication(connection: Connection) {
  if (!connection.userId || !connection.sessionId) {
    throw new UnauthorizedException('AUTHENTICATION_REQUIRED');
  }
}
