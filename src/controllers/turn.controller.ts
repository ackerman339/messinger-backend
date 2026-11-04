import { Request, Response } from 'express';
import { turnService } from '@services';

export async function getTurnCredentials(_req: Request, res: Response) {
  const userId = res.locals.userId!;
  const credentials = turnService.generateCredentials(userId);

  res.status(200).json(credentials);
}
