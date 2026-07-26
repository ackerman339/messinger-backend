import { randomInt, createHmac } from 'node:crypto';
import { env } from '@config/environment';
import { FRIENDLY_ALPHABET } from '@constants';

export function generateRandomString(length: number) {
  let value = '';

  for (let i = 0; i < length; i++) {
    value += FRIENDLY_ALPHABET[randomInt(FRIENDLY_ALPHABET.length)];
  }

  return value;
}

export function generateLoginKeyLookup(loginKey: string): string {
  const secretBuffer = Buffer.from(env.LOGIN_KEY_SECRET, 'hex');

  return createHmac('sha256', secretBuffer).update(loginKey.trim().toUpperCase()).digest('hex');
}
