import cron from 'node-cron';
import { logger } from '@config/logger';
import { callService, callNegotiationService } from '@services';
import { notifyCallNoAnswer } from '@websocket/handlers/notify-no-answer-call';
import { notifyCallConnectionTimeout } from '@websocket/handlers/notify-call-connection-timeout';
import { notifyCallNegotiationEnd } from '@websocket/handlers/notify-call-negotiation-end';
import { notifyCallRecoveryTimeout } from '@websocket/handlers/notify-call-recovery-timeout';

const CRON_EXPRESSION = '*/5 * * * * *';

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

async function expireRecoveringCalls() {
  try {
    const calls = await callService.expireRecovery();

    for (const call of calls) {
      notifyCallRecoveryTimeout(call);
    }

    if (calls.length > 0) {
      logger.info(`[call-expiration] ${calls.length} calls failed to recover.`);
    }
  } catch (error) {
    logger.error('[call-expiration] Failed to expire recovering calls:', error);
  }
}

async function expireNegotiations() {
  try {
    const negotiations = await callNegotiationService.expirePending();

    for (const negotiation of negotiations) {
      notifyCallNegotiationEnd(negotiation);
    }
  } catch (error) {
    logger.error('[call-expiration] Failed to expire negotiations:', error);
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
    await expireRecoveringCalls();
    await expireNegotiations();
  } finally {
    running = false;
  }
}

export const expireCallsJob = cron.schedule(CRON_EXPRESSION, expireCalls, {
  timezone: 'America/Bogota',
});
