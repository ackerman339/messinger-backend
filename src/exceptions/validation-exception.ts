import { BaseException } from './base-exception';

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
}

export class ValidationException extends BaseException {
  public errors: ValidationError[];

  constructor(message: string = 'Validation error', errors: ValidationError[] = []) {
    super(message, 422, 'VALIDATION_ERROR');
    this.errors = errors;
  }

  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        errors: this.errors,
      },
    };
  }
}
