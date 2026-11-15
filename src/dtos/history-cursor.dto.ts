import { z } from 'zod';

// Timestamp + ID keeps pagination valid after the referenced record is deleted.
export const HistoryCursorSchema = z.union([
  z.uuid(),
  z.string().regex(/^\d{1,13}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
]);
