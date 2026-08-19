import { Request, Response } from 'express';
import { AdminDto, UserDto, ListUserMessagesDto, ListUsersDto, ListConversationsDto } from '@dtos';
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
  const dto = res.locals.validatedDto as ListUsersDto;
  const result = await adminService.listUsers(dto);

  res.status(201).json({
    message: 'Users list',
    result,
  });
}

export async function listAdmins(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as ListUsersDto;
  const result = await adminService.listAdmins(dto);

  res.status(201).json({
    message: 'Admins list',
    result,
  });
}

export async function listUserConversations(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as ListConversationsDto;
  const result = await adminService.listUserConversations(dto);

  res.status(201).json({
    message: 'User conversations',
    result,
  });
}

export async function listConversationMessages(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as ListUserMessagesDto;
  const result = await adminService.listConversationMessages(dto);

  res.status(201).json({
    message: 'Conversation messages',
    result,
  });
}

export async function updateAdminPassword(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as Pick<AdminDto, 'password'>;
  const userId = res.locals.userId!;

  await adminService.updateAdminPassword(userId, dto);

  res.sendStatus(204);
}
