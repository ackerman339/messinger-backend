import jwt, { SignOptions } from 'jsonwebtoken';
import { add, Duration } from 'date-fns';
import { env } from '@config/environment';
import { AppDataSource } from '@config/database';
import { SessionRevokeReason, UserRole } from '@appTypes';
import { Session, User } from '@entities';
import { hashToken } from '@utils';

type CreateSessionParams = {
  user: User;
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
  async createSession({ user, roles, userAgent, ipAddress }: CreateSessionParams) {
    const accessToken = jwt.sign({ sub: user.id, roles }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign({ sub: user.id, roles }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    });

    const newSession = this.create({
      user,
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
});
