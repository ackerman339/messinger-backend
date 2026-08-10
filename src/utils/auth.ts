import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { env } from '@config/environment';

type SetAuthCookiesParams = {
  res: Response;
  accessToken: string;
  refreshToken: string;
  isAdmin?: boolean;
};

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setAuthCookies({
  res,
  accessToken,
  refreshToken,
  isAdmin = false,
}: SetAuthCookiesParams) {
  const accessCookieName = isAdmin ? 'admin_access_token' : 'user_access_token';
  const refreshCookieName = isAdmin ? 'admin_refresh_token' : 'user_refresh_token';

  res.cookie(accessCookieName, accessToken, {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    maxAge: env.ACCESS_COOKIE_MAX_AGE,
  });

  res.cookie(refreshCookieName, refreshToken, {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    domain: env.COOKIE_DOMAIN,
    maxAge: env.REFRESH_COOKIE_MAX_AGE,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  });

  res.clearCookie('refreshToken', {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  });
}

export function getClientInfo(req: Request) {
  return {
    userAgent: req.headers['user-agent'] ?? 'unknown',
    ipAddress:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket.remoteAddress ??
      null,
  };
}
