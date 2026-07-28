import { z } from 'zod';
import { MessageStatus } from '@appTypes';

export const MessageDeliverySchema = z.object({
  messageId: z.uuid(),
  status: z.enum(MessageStatus),
});

export type MessageDeliveryDto = z.infer<typeof MessageDeliverySchema>;
