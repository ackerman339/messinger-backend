import { FRIENDLY_ALPHABET, LOGIN_KEY_LENGTH } from './common';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]+(?:\s[a-zA-Z0-9_-]+)*$/;
export const LOGIN_KEY_REGEX = new RegExp(`^[${FRIENDLY_ALPHABET}]{${LOGIN_KEY_LENGTH}}$`);
