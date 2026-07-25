import { BaseException } from './base-exception';

export class NotFoundException extends BaseException {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}
