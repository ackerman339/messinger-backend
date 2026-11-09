import { env } from '@config/environment';
import { PushNotificationPayload } from '@dtos';
import { BaseException } from '@exceptions';

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
    const result = (await this.request({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
      channelId: 'messages',
      ttl: options?.ttl,
      priority: options?.priority ?? 'high',
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
