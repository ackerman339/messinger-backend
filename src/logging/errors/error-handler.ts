import { Request, Response, NextFunction } from 'express';
import { env } from '@config/environment';
import { BaseException } from '@exceptions';
import { logger } from '@config/logger';
import { getRequestId } from '../context/get-request-id';

export const errorHandler = (
  error: Error | BaseException,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = getRequestId();

  logger.error('HTTP Error', {
    ...error,
    path: req.originalUrl,
    method: req.method,
    requestId,
    ...(env.NODE_ENV === 'production'
      ? {}
      : { body: req.body, query: req.query, params: req.params, trace: error.stack }),
  });

  if (error instanceof BaseException) {
    return res.status(error.httpCode).json({
      requestId,
      ...error.toJSON(),
    });
  }

  return res.status(500).json({
    success: false,
    requestId,
    error: {
      code: 'UNHANDLED_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message,
    },
  });
};
