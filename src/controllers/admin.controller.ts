import { Request, Response } from 'express';
import { AdminDto, UserDto, ListUserMessagesDto } from '@dtos';
import { authService, adminService } from '@services';
import { getClientInfo, setAuthCookies } from '@utils';

export async function createAdmin(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as AdminDto;
  const admin = await authService.createAdmin(dto);

  res.status(201).json({
    message: 'User created successfully',
    result: admin,
  });
}

export async function adminSignIn(req: Request, res: Response) {
  const { userAgent, ipAddress } = getClientInfo(req);
  const dto = res.locals.validatedDto as AdminDto;
  const { adminName, accessToken, refreshToken } = await authService.adminSignIn(
    dto,
    userAgent,
    ipAddress
  );

  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json({
    message: 'User logged successfully',
    result: {
      adminName,
    },
  });
}

export async function restoreUserLoginKey(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as UserDto;
  const { loginKey } = await adminService.restoreUserLoginKey(dto);

  res.status(201).json({
    message: 'Login key restored',
    result: {
      loginKey,
    },
  });
}

export async function deleteUser(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as UserDto;

  await adminService.deleteUser(dto);

  res.sendStatus(204);
}

export async function deleteAmin(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as UserDto;

  await adminService.deleteAdmin(dto);

  res.sendStatus(204);
}

export async function listUsers(_req: Request, res: Response) {
  const users = await adminService.listUsers();

  res.status(201).json({
    message: 'Users list',
    result: {
      users,
    },
  });
}

export async function listAdmins(_req: Request, res: Response) {
  const admins = await adminService.listAdmins();

  res.status(201).json({
    message: 'Admins list',
    result: {
      admins,
    },
  });
}

export async function listUserConversations(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as UserDto;
  const conversations = await adminService.listUserConversations(dto);

  res.status(201).json({
    message: 'User conversations',
    result: {
      conversations,
    },
  });
}

export async function listConversationMessages(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as ListUserMessagesDto;
  const messages = await adminService.listConversationMessages(dto);

  res.status(201).json({
    message: 'Conversation messages',
    result: {
      messages,
    },
  });
}
