declare global {
  namespace Express {
    interface Locals {
      validatedDto: Record<string, unknown>;
    }
  }
}
