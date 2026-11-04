import { z } from 'zod';
import { CallMedia } from '@appTypes';

export const CallInitSchema = z.object({
  calleeId: z.uuid(),
  media: z.enum(CallMedia),
});

export type CallInitDto = z.infer<typeof CallInitSchema>;
