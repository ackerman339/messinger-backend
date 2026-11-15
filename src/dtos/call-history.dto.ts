import { HistoryCursorSchema } from './history-cursor.dto';
import { z } from 'zod';
import { env } from '@config/environment';

export const CallHistorySchema = z.object({
  cursor: HistoryCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
});

export type CallHistoryDto = z.infer<typeof CallHistorySchema>;

export const DeleteCallHistorySchema = z.object({
  callId: z.uuid(),
});

export type DeleteCallHistoryDto = z.infer<typeof DeleteCallHistorySchema>;
