import { z } from 'zod';

export const GetUserByCodeSchema = z.object({
  userCode: z.string().min(1),
});

export type GetUserByCodeDto = z.infer<typeof GetUserByCodeSchema>;
