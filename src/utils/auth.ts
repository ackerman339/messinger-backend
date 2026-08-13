import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { env } from '@config/environment';

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: env.ACCESS_COOKIE_MAX_AGE,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    maxAge: env.REFRESH_COOKIE_MAX_AGE,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  });

  res.clearCookie('refreshToken', {
    httpOnly: env.COOKIE_HTTP_ONLY,
    secure: env.COOKIE_SECURE,
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

export function getAccessToken(req: Request): string | undefined {
  // Via cookies
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  // Via headers
  const authorization = req.headers.authorization;

  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  return token;
}

export function getRefreshToken(req: Request): string | undefined {
  // Via cookies
  if (req.cookies?.refreshToken) {
    return req.cookies.refreshToken;
  }

  // Via headers
  const refreshToken = req.headers['x-refresh-token'];

  if (Array.isArray(refreshToken)) {
    return refreshToken[0];
  }

  return refreshToken;
}
