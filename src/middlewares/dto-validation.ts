import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodObject } from 'zod';
import { type ValidationError, ValidationException } from '../exceptions';

function getNestedValue(obj: Record<PropertyKey, unknown>, path: PropertyKey[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<PropertyKey, unknown>)[key];
    }

    return current;
  }, obj);
}

export const validateDTO = (schema: ZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        ...req.body,
        ...req.query,
        ...req.params,
      });

      res.locals.validatedDto = validated;

      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const requestData = {
          ...req.body,
          ...req.query,
          ...req.params,
        };

        const formattedErrors: ValidationError[] = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          value: err.path.length > 0 ? getNestedValue(requestData, err.path) : undefined,
        }));

        return next(new ValidationException('DTO validation error', formattedErrors));
      } else {
        return next(error);
      }
    }
  };
};
