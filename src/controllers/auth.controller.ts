import { Request, Response } from 'express';
import { authService, userService } from '@services';
import { SignInDto } from '@dtos';
import { getClientInfo, setAuthCookies, clearAuthCookies } from '@utils';

export async function signin(req: Request, res: Response) {
  const { userAgent, ipAddress } = getClientInfo(req);
  const dto = res.locals.validatedDto as SignInDto;
  const { user, accessToken, refreshToken } = await authService.signin(dto, userAgent, ipAddress);
  const { username, status, id, userCode, avatarUrl, role, createdAt, updatedAt } = user;

  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json({
    message: 'User logged successfully',
    result: {
      id,
      userCode,
      avatarUrl,
      role,
      createdAt,
      updatedAt,
      username,
      status,
    },
  });
}

export async function mobileSignin(req: Request, res: Response) {
  const { userAgent, ipAddress } = getClientInfo(req);
  const dto = res.locals.validatedDto as SignInDto;
  const { user, accessToken, refreshToken } = await authService.signin(dto, userAgent, ipAddress);
  const { username, status, id, userCode, avatarUrl, role, createdAt, updatedAt } = user;

  res.setHeader('x-access-token', accessToken);
  res.setHeader('x-refresh-token', refreshToken);

  res.status(201).json({
    message: 'User logged successfully',
    result: {
      id,
      userCode,
      avatarUrl,
      role,
      createdAt,
      updatedAt,
      username,
      status,
    },
  });
}

export async function getMe(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  const user = await userService.getMe(userId);

  res.status(201).json({
    message: 'User logged successfully',
    result: {
      ...user,
    },
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken =
    req.cookies?.refreshToken ??
    (typeof req.headers['x-refresh-token'] === 'string'
      ? req.headers['x-refresh-token']
      : undefined);

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  clearAuthCookies(res);

  res.sendStatus(204);
}
