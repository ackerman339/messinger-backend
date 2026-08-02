import { Request, Response } from 'express';
import { authService } from '@services';
import { SignUpDto, SignInDto } from '@dtos';
import { getClientInfo, setAuthCookies, clearAuthCookies } from '@utils';

export async function signup(req: Request, res: Response) {
  const dto = res.locals.validatedDto as SignUpDto;
  const { userAgent, ipAddress } = getClientInfo(req);
  const { user, loginKey, accessToken, refreshToken } = await authService.signup(
    dto,
    userAgent,
    ipAddress
  );
  const { username, status } = user;

  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json({
    message: 'User created successfully',
    result: {
      username,
      status,
      loginKey,
    },
  });
}

export async function signin(req: Request, res: Response) {
  const { userAgent, ipAddress } = getClientInfo(req);
  const dto = res.locals.validatedDto as SignInDto;
  const { user, accessToken, refreshToken } = await authService.signin(dto, userAgent, ipAddress);
  const { username, status } = user;

  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json({
    message: 'User logged successfully',
    result: {
      username,
      status,
    },
  });
}

export async function logout(req: Request, res: Response) {
  const refreshToken: string | undefined = req.cookies?.refreshToken;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  clearAuthCookies(res);

  res.sendStatus(204);
}
