import { notifyCallHistoryDeleted } from '@websocket/handlers/notify-call-history-deleted';
import { Request, Response } from 'express';
import { CallHistoryDto, DeleteCallHistoryDto } from '@dtos';
import { callService } from '@services';

export async function getCallsHistory(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  const validatedDto = res.locals.validatedDto as CallHistoryDto;
  const result = await callService.getHistory(userId, validatedDto);

  res.status(200).json({ message: 'Calls history loaded', result });
}

export async function deleteCallHistory(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  const { callId } = res.locals.validatedDto as DeleteCallHistoryDto;
  await callService.deleteHistory(userId, callId);
  notifyCallHistoryDeleted(userId, callId);
  res.sendStatus(204);
}

export async function deleteAllCallHistory(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  await callService.deleteAllHistory(userId);
  notifyCallHistoryDeleted(userId);
  res.sendStatus(204);
}
