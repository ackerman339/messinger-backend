import { logger } from '@config/logger';
import { env } from '@config/environment';
import { PushNotificationPayload } from '@dtos';
import { BaseException } from '@exceptions';
import type { PushPlatform } from '@appTypes';

// Describe the fields we consume without enforcing Expo's response shape at runtime.
interface ExpoPushResult {
  status?: string;
  id?: string;
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
  recipientId?: string;
  ttl?: number;
  priority?: 'default' | 'normal' | 'high';
}

class MobilePushService {
  private async request(body: unknown, endpoint = 'send') {
    const response = await fetch(`https://exp.host/--/api/v2/push/${endpoint}`, {
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

  private trackReceipt(callId: string, ticketId: string, attempt = 0) {
    const timer = setTimeout(
      async () => {
        try {
          const result = (await this.request({ ids: [ticketId] }, 'getReceipts')) as {
            data?: Record<string, ExpoPushResult>;
          };
          const receipt = result?.data?.[ticketId] as ExpoPushResult | undefined;
          if (!receipt && attempt < 3) {
            this.trackReceipt(callId, ticketId, attempt + 1);
            return;
          }
          logger.info('[calls] push-receipt', {
            callId,
            ticketId,
            status: receipt?.status ?? 'pending',
            code: receipt?.details?.error,
          });
        } catch {
          logger.warn('[calls] push-receipt-query-failed', { callId, ticketId });
          if (attempt < 3) this.trackReceipt(callId, ticketId, attempt + 1);
        }
      },
      60_000 * (attempt + 1)
    );
    timer.unref();
  }

  async send(token: string, payload: PushNotificationPayload, options?: MobilePushOptions) {
    const incomingCall = payload.data.type === 'call-incoming' && options?.platform !== 'IOS';
    const result = (await this.request({
      to: token,
      data: { ...payload.data, recipientId: options?.recipientId },
      // Android calls are presented by the native FCM receiver before Expo starts JS.
      ...(incomingCall
        ? { _contentAvailable: true }
        : { title: payload.title, body: payload.body, sound: 'default', channelId: 'messages' }),
      ttl: options?.ttl,
      priority: incomingCall ? 'high' : (options?.priority ?? 'high'),
    })) as ExpoPushResponse;

    if (incomingCall)
      logger.info('[calls] push-ticket', {
        callId: 'callId' in payload.data ? payload.data.callId : undefined,
        ticketId: result?.data?.id,
        status: result?.data?.status,
      });

    if (incomingCall && 'callId' in payload.data && result?.data?.id)
      this.trackReceipt(payload.data.callId, result.data.id);

    if (result?.errors?.length) {
      throw new MobilePushError(result.errors[0].code ?? 'UnknownError');
    }

    if (result?.data?.status === 'error') {
      throw new MobilePushError(result.data.details?.error ?? 'UnknownError');
    }
  }
}

export const mobilePushService = new MobilePushService();
