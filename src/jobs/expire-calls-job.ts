import cron from 'node-cron';
import { logger } from '@config/logger';
import { callService } from '@services';
import { notifyCallNoAnswer } from '@websocket/handlers/notify-no-answer-call';
import { notifyCallConnectionTimeout } from '@websocket/handlers/notify-call-connection-timeout';

const CRON_EXPRESSION = '*/5 * * * * *'; // Every 5 seconds.

let running = false;

async function expireRingingCalls() {
  try {
    const calls = await callService.expireRinging();

    for (const call of calls) {
      notifyCallNoAnswer(call);
    }

    if (calls.length > 0) {
      logger.info(`[call-expiration] ${calls.length} calls marked as missed.`);
    }
  } catch (error) {
    logger.error('[call-expiration] Failed to expire ringing calls:', error);
  }
}

async function expireConnectingCalls() {
  try {
    const calls = await callService.expireConnecting();

    for (const call of calls) {
      notifyCallConnectionTimeout(call);
    }

    if (calls.length > 0) {
      logger.info(`[call-expiration] ${calls.length} calls failed to connect.`);
    }
  } catch (error) {
    logger.error('[call-expiration] Failed to expire connecting calls:', error);
  }
}

async function expireCalls() {
  if (running) {
    return;
  }

  running = true;

  try {
    await expireRingingCalls();
    await expireConnectingCalls();
  } finally {
    running = false;
  }
}

export const expireCallsJob = cron.schedule(CRON_EXPRESSION, expireCalls, {
  timezone: 'America/Bogota',
});
