import { Request, Response } from 'express';
import { NotFoundException } from '@exceptions';
import { userService } from '@services';
import { GetUserByCodeDto } from '@dtos';

export async function getUserByCode(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as GetUserByCodeDto;
  const user = await userService.findUserByCode(dto.userCode);

  if (!user) {
    throw new NotFoundException('USER_NOT_FOUND');
  }

  res.status(200).json({
    message: 'Conversations loaded',
    result: {
      ...user,
    },
  });
}
