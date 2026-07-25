import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncLocalStorage } from '../context/async-context';

export const contextMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  const requestId = randomUUID();

  asyncLocalStorage.run({ requestId }, () => {
    next();
  });
};
