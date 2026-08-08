import { z } from 'zod';
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_REGEX } from '@constants';

export const AdminSchema = z.object({
  password: z.string().min(8).max(100),
  adminName: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(
          USERNAME_MIN_LENGTH,
          `Username must contain at least ${USERNAME_MIN_LENGTH} characters.`
        )
        .max(USERNAME_MAX_LENGTH, `Username cannot exceed ${USERNAME_MAX_LENGTH} characters.`)
        .regex(
          USERNAME_REGEX,
          'Username can only contain letters, numbers, "_", "-" and single spaces.'
        )
    ),
});

export const UserSchema = z.object({
  userId: z.uuid(),
});

export const ListUserMessagesSchema = z.object({
  userId: z.uuid(),
  conversationId: z.uuid(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export type AdminDto = z.infer<typeof AdminSchema>;
export type UserDto = z.infer<typeof UserSchema>;
export type ListUserMessagesDto = z.infer<typeof ListUserMessagesSchema>;
