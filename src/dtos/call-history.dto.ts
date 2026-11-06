import { z } from 'zod';
import { env } from '@config/environment';

export const CallHistorySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
});

export type CallHistoryDto = z.infer<typeof CallHistorySchema>;
