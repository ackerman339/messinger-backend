import { randomUUID } from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { add, Duration, differenceInMilliseconds } from 'date-fns';
import { env } from '@config/environment';
import { AppDataSource } from '@config/database';
import { SessionRevokeReason, UserRole } from '@appTypes';
import { Session } from '@entities';
import { hashToken } from '@utils';

const REFRESH_ROTATION_GRACE_PERIOD = 5_000;

type CreateSessionParams = {
  userId: string;
  roles: UserRole[];
  userAgent: string;
  ipAddress: string | null;
};

function parseExpiry(expiry: string): Duration {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1));

  const map: Record<string, keyof Duration> = {
    s: 'seconds',
    m: 'minutes',
    h: 'hours',
    d: 'days',
  };

  return { [map[unit]]: value };
}

export const SessionRepository = AppDataSource.getRepository(Session).extend({
  async createSession({ userId, roles, userAgent, ipAddress }: CreateSessionParams) {
    const sessionId = randomUUID();

    const accessToken = jwt.sign({ sub: userId, roles, sid: sessionId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ sub: userId, roles, sid: sessionId }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    });

    const newSession = this.create({
      id: sessionId,
      userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: add(new Date(), parseExpiry(env.JWT_REFRESH_EXPIRES_IN)),
      userAgent,
      ipAddress,
    });

    await this.save(newSession);

    return { accessToken, refreshToken };
  },

  async revokeSession(sessionId: string, reason: SessionRevokeReason) {
    await this.update(sessionId, {
      isRevoked: true,
      revokedReason: reason,
    });
  },

  async rotateSession(sessionId: string, roles: UserRole[], refreshToken: string) {
    return AppDataSource.transaction(async (manager) => {
      const session = await manager
        .getRepository(Session)
        .createQueryBuilder('session')
        .setLock('pessimistic_write')
        .where('session.id = :sessionId', { sessionId })
        .getOne();

      if (!session) {
        return null;
      }

      const refreshTokenHash = hashToken(refreshToken);

      // Another concurrent request has already rotated the token.
      if (
        session.rotatedAt &&
        session.previousRefreshTokenHash === refreshTokenHash &&
        differenceInMilliseconds(new Date(), session.rotatedAt) <= REFRESH_ROTATION_GRACE_PERIOD
      ) {
        return {
          accessToken: session.rotatedAccessToken!,
          refreshToken: session.rotatedRefreshToken!,
        };
      }

      // The provided refresh token is no longer valid.
      if (session.refreshTokenHash !== refreshTokenHash) {
        return null;
      }

      const accessToken = jwt.sign(
        {
          sub: session.userId,
          roles,
          sid: session.id,
        },
        env.JWT_SECRET,
        {
          expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
        }
      );

      const newRefreshToken = jwt.sign(
        {
          sub: session.userId,
          roles,
          sid: session.id,
        },
        env.JWT_REFRESH_SECRET,
        {
          expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
        }
      );

      /*
       * Keep the previous refresh token to handle
       * concurrent requests during the grace period.
       */
      await manager.update(Session, session.id, {
        previousRefreshTokenHash: session.refreshTokenHash,
        rotatedRefreshToken: newRefreshToken,
        rotatedAccessToken: accessToken,
        refreshTokenHash: hashToken(newRefreshToken),
        rotatedAt: new Date(),
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    });
  },
});
