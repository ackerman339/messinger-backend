import { Request, Response } from 'express';
import { WebPushSubscriptionDto, WebPushUnsubscriptionDto } from '@dtos';
import { pushSubscriptionService } from '@services';

export async function subscribeWeb(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  const dto = res.locals.validatedDto as WebPushSubscriptionDto;

  await pushSubscriptionService.subscribeWeb(userId, dto);

  res.sendStatus(204);
}

export async function unsubscribeWeb(_req: Request, res: Response) {
  const dto = res.locals.validatedDto as WebPushUnsubscriptionDto;

  await pushSubscriptionService.unsubscribeWeb(dto.endpoint);

  res.sendStatus(204);
}
