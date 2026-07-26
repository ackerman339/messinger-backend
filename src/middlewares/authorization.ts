import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@appTypes';
import { ForbiddenException } from '@exceptions';

export const authorize = (...allowed: UserRole[]) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    const roles = res.locals.roles as UserRole[];

    if (!roles.length) {
      return next(new ForbiddenException("Forbidden, user hasn't privileges"));
    }

    const hasRole = roles?.some((role) => allowed.includes(role));

    if (!hasRole) {
      return next(new ForbiddenException("Forbidden, user hasn't enough privileges"));
    }

    return next();
  };
};
