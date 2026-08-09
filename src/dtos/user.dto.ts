import { z } from 'zod';
import { env } from '@config/environment';

export const GetUserByCodeSchema = z.object({
  userCode: z.string().min(1),
});

export const ListUsersSchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
});

export type GetUserByCodeDto = z.infer<typeof GetUserByCodeSchema>;
export type ListUsersDto = z.infer<typeof ListUsersSchema>;
