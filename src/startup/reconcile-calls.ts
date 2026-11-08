import { setTimeout as delay } from 'node:timers/promises';
import { logger } from '@config/logger';
import { callService } from '@services';

const MAX_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 10_000;

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };

  const code = candidate.driverError?.code ?? candidate.code;

  if (!code) {
    return false;
  }

  // PostgreSQL connection errors.
  if (code.startsWith('08')) {
    return true;
  }

  return [
    '40001', // Serialization failure.
    '40P01', // Deadlock detected.
    '57P01', // Administrative shutdown.
    '57P02', // Crash shutdown.
    '57P03', // Database temporarily unavailable.
    '53300', // Too many connections.
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
    'EAI_AGAIN',
  ].includes(code);
}

export async function reconcileCallsOnStartup() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { callsClosed, negotiationsCancelled } = await callService.reconcileAfterRestart();

      logger.info(
        '[call-reconciliation] Completed: ' +
          `callsClosed=${callsClosed} ` +
          `negotiationsCancelled=${negotiationsCancelled}`
      );

      return;
    } catch (error) {
      const canRetry = attempt < MAX_ATTEMPTS && isRetryableError(error);

      if (!canRetry) {
        logger.error(
          `[call-reconciliation] Failed on attempt ${attempt}; ` + 'startup aborted:',
          error
        );

        throw error;
      }

      const retryDelayMs = Math.min(
        INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1),
        MAX_RETRY_DELAY_MS
      );

      logger.warn(
        `[call-reconciliation] Attempt ${attempt}/${MAX_ATTEMPTS} ` +
          `failed; retrying in ${retryDelayMs}ms:`,
        error
      );

      await delay(retryDelayMs);
    }
  }
}
