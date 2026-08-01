import { z } from 'zod';
import { MessageStatus } from '@appTypes';

export const MessageDeliverySchema = z.object({
  conversationId: z.uuid(),
  messageId: z.uuid(),
  status: z.enum(MessageStatus),
});

export type MessageDeliveryDto = z.infer<typeof MessageDeliverySchema>;
