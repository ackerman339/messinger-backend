import { UserRole } from '@appTypes';
declare global {
  namespace Express {
    interface Locals {
      userId?: string;
      roles?: UserRole[];
      validatedDto: Record<string, unknown>;
    }
  }
}
