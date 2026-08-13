import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@config/logger';
import { env } from '@config/environment';
import { SessionRevokeReason, UserRole } from '@appTypes';
import { UnauthorizedException } from '@exceptions';
import { Session } from '@entities';
import { SessionRepository } from '@repositories';

import {
  setAuthCookies,
  getClientInfo,
  hashToken,
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
} from '@utils';

async function rotateRefreshToken(req: Request, roles: UserRole[], oldSession: Session) {
  // Revoke prev session
  await SessionRepository.update(oldSession.id, {
    isRevoked: true,
    revokedReason: SessionRevokeReason.TIMEOUT,
  });

  const { ipAddress, userAgent } = getClientInfo(req);

  return await SessionRepository.createSession({
    userId: oldSession.userId,
    roles,
    userAgent,
    ipAddress,
  });
}

async function revokeAllSessions(userId: string) {
  await SessionRepository.update(
    { userId, isRevoked: false },
    {
      isRevoked: true,
      revokedReason: SessionRevokeReason.SUSPICIOUS,
    }
  );
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const accessToken = getAccessToken(req);
  const refreshToken = getRefreshToken(req);

  // 1. Try access token
  if (accessToken) {
    try {
      const payload = jwt.verify(accessToken, env.JWT_SECRET) as jwt.JwtPayload;
      res.locals.userId = payload.sub as string;
      res.locals.roles = payload.roles as UserRole[];
      return next();
    } catch (err) {
      if (!(err instanceof jwt.TokenExpiredError)) {
        // Invalid signature or other error — do not attempt refresh
        clearAuthCookies(res);
        return next(new UnauthorizedException('INVALID_ACCESS_TOKEN'));
      }
    }
  }

  // 2. Access token expired → refresh token required
  if (!refreshToken) {
    return next(new UnauthorizedException('INVALID_AUTHENTICATION'));
  }

  const session = await SessionRepository.findOne({
    where: { refreshTokenHash: hashToken(refreshToken!) },
  });

  try {
    // 3. Verify refresh token
    const payload = jwt.verify(refreshToken!, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    const userId = payload.sub as string;
    const roles = payload.roles as UserRole[];

    // 4. Session must exist
    if (!session) {
      clearAuthCookies(res);
      return next(new UnauthorizedException('INVALID_SESSION'));
    }

    // 5. Reused/revoked refresh token
    if (session.isRevoked) {
      await revokeAllSessions(userId);
      clearAuthCookies(res);
      return next(new UnauthorizedException('SUSPICIOUS_ACTIVITY_DETECTED'));
    }

    // 6. Legitimately expired
    if (session.expiresAt < new Date()) {
      await SessionRepository.update(session.id, {
        isRevoked: true,
        revokedReason: SessionRevokeReason.EXPIRED,
      });
      clearAuthCookies(res);
      return next(new UnauthorizedException('EXPIRED_SESSION'));
    }

    // 7. All good → rotate tokens
    const result = await rotateRefreshToken(req, roles, session);
    const authorization = req.headers.authorization;
    const isBearerClient = typeof authorization === 'string' && /^Bearer\s+/i.test(authorization);

    if (isBearerClient) {
      res.setHeader('x-access-Token', result.accessToken);
      res.setHeader('x-refresh-Token', result.refreshToken);
    } else {
      setAuthCookies(res, result.accessToken, result.refreshToken);
    }

    res.locals.userId = userId;
    res.locals.roles = roles;
    return next();
  } catch (error) {
    // 8. Invalid refresh token signature
    await SessionRepository.update(session!.id, {
      isRevoked: true,
      revokedReason:
        error instanceof jwt.TokenExpiredError
          ? SessionRevokeReason.EXPIRED
          : SessionRevokeReason.INVALID,
    });

    logger.error(error);
    clearAuthCookies(res);
    return next(new UnauthorizedException('INVALID_SESSION'));
  }
}
