export class BaseException extends Error {
  public code: string;
  public httpCode: number;
  public stackTrace?: string | undefined;

  constructor(message: string, httpCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    Error.captureStackTrace(this, this.constructor);

    this.httpCode = httpCode;
    this.code = code;
    this.name = this.constructor.name;
    this.stackTrace = this.stack;
  }

  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
      },
    };
  }
}
