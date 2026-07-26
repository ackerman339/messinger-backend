import { z } from 'zod';
import { UserRole } from '@appTypes';
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
  LOGIN_KEY_LENGTH,
  LOGIN_KEY_REGEX,
} from '@constants';

export const signUpSchema = z.object({
  role: z.enum(UserRole).default(UserRole.USER),
  username: z
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

export const signInSchema = z.object({
  loginKey: z
    .string()
    .trim()
    .transform((value) => value.replace(/-/g, '').toUpperCase())
    .pipe(
      z
        .string()
        .length(LOGIN_KEY_LENGTH, 'Invalid login key.')
        .regex(LOGIN_KEY_REGEX, 'Invalid login key.')
    ),
});

export type SignUpDto = z.infer<typeof signUpSchema>;
export type SignInDto = z.infer<typeof signInSchema>;
