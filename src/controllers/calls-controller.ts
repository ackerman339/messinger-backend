import { Request, Response } from 'express';
import { CallHistoryDto } from '@dtos';
import { callService } from '@services';

export async function getCallsHistory(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  const validatedDto = res.locals.validatedDto as CallHistoryDto;
  const result = await callService.getHistory(userId, validatedDto);

  res.status(200).json(result);
}
