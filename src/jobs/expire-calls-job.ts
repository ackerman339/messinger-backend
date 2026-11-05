import cron from 'node-cron';
import { logger } from '@config/logger';
import { callService } from '@services';
import { notifyCallNoAnswer } from '@websocket/handlers/notify-no-answer-call';

const CRON_EXPRESSION = '*/5 * * * * *'; // Every 5 seconds.

let running = false;

async function expireCalls() {
  if (running) {
    return;
  }

  running = true;

  try {
    const expiredCalls = await callService.expireRinging();

    if (expiredCalls.length === 0) {
      return;
    }

    logger.info(`[call-expiration] ${expiredCalls.length} calls marked as missed.`);

    for (const call of expiredCalls) {
      notifyCallNoAnswer(call);
    }

    logger.info('[call-expiration] Job finished.');
  } catch (error) {
    logger.error('[call-expiration] Failed to expire calls, aborting job:', error);
  } finally {
    running = false;
  }
}

export const expireCallsJob = cron.schedule(CRON_EXPRESSION, expireCalls, {
  timezone: 'America/Bogota',
});
