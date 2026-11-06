import cron from 'node-cron';
import { logger } from '@config/logger';
import { callService, callNegotiationService } from '@services';
import { notifyCallNoAnswer } from '@websocket/handlers/notify-call-no-answer';
import { notifyCallConnectionTimeout } from '@websocket/handlers/notify-call-connection-timeout';
import { notifyCallNegotiationEnd } from '@websocket/handlers/notify-call-negotiation-end';
import { notifyCallRecoveryTimeout } from '@websocket/handlers/notify-call-recovery-timeout';

const CRON_EXPRESSION = '*/5 * * * * *';

let running = false;

async function expireRingingCalls() {
  const calls = await callService.expireRinging();

  for (const call of calls) {
    notifyCallNoAnswer(call);
  }

  if (calls.length > 0) {
    logger.info(`[call-expiration] ${calls.length} calls marked as missed.`);
  }
}

async function expireConnectingCalls() {
  const calls = await callService.expireConnecting();

  for (const call of calls) {
    notifyCallConnectionTimeout(call);
  }

  if (calls.length > 0) {
    logger.info(`[call-expiration] ${calls.length} calls failed to connect.`);
  }
}

async function expireRecoveringCalls() {
  const calls = await callService.expireRecovery();

  for (const call of calls) {
    notifyCallRecoveryTimeout(call);
  }

  if (calls.length > 0) {
    logger.info(`[call-recover] ${calls.length} calls failed to recover.`);
  }
}

async function expireNegotiations() {
  const negotiations = await callNegotiationService.expirePending();

  for (const negotiation of negotiations) {
    notifyCallNegotiationEnd(negotiation);
  }

  if (negotiations.length > 0) {
    logger.info(`[negotiation-expiration] ${negotiations.length} negotiations failed to recover.`);
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
