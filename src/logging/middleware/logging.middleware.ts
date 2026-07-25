import { Request, Response, NextFunction } from 'express';
import { env } from '@config/environment';
import { logger } from '@config/logger';
import { getRequestId } from '../context/get-request-id';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = getRequestId();

  res.on('finish', () => {
    logger.http('HTTP Request', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      requestId,
      duration: Date.now() - start,
      ...(env.NODE_ENV === 'production'
        ? {}
        : { body: req.body, query: req.query, params: req.params }),
    });
  });

  next();
};
