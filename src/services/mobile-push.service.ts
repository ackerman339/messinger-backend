import { env } from '@config/environment';
import { PushNotificationPayload } from '@dtos';
import { BaseException } from '@exceptions';
import type { PushPlatform } from '@appTypes';

// Describe the fields we consume without enforcing Expo's response shape at runtime.
interface ExpoPushResult {
  status?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data?: ExpoPushResult;
  errors?: { code?: string }[];
}

export class MobilePushError extends BaseException {
  constructor(code: string) {
    super(`Expo push failed: ${code}`, 502, code);
  }
}

export interface MobilePushOptions {
  platform?: PushPlatform;
  ttl?: number;
  priority?: 'default' | 'normal' | 'high';
}

class MobilePushService {
  private async request(body: unknown) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new MobilePushError(`HTTP_${response.status}`);
    }

    return response.json();
  }

  async send(token: string, payload: PushNotificationPayload, options?: MobilePushOptions) {
    const incomingCall = payload.data.type === 'call-incoming' && options?.platform !== 'IOS';
    const result = (await this.request({
      to: token,
      data: payload.data,
      // Presentation fields make Android show the push without starting the terminated app's task.
      // Incoming calls must wake that task; it creates the native ringing notification and actions.
      ...(incomingCall
        ? { _contentAvailable: true }
        : { title: payload.title, body: payload.body, sound: 'default', channelId: 'messages' }),
      ttl: options?.ttl,
      priority: incomingCall ? 'high' : (options?.priority ?? 'high'),
    })) as ExpoPushResponse;

    if (result?.errors?.length) {
      throw new MobilePushError(result.errors[0].code ?? 'UnknownError');
    }

    if (result?.data?.status === 'error') {
      throw new MobilePushError(result.data.details?.error ?? 'UnknownError');
    }
  }
}

export const mobilePushService = new MobilePushService();
