import cron from 'node-cron';
import { subDays } from 'date-fns';
import { logger } from '@config/logger';
import { MessageRepository } from '@repositories';
import { storageService } from '@services';

const MAX_MESSAGE_AGE_DAYS = 2;
const CRON_EXPRESSION = '0 3 * * *'; // every day at 3:00 AM COP

async function deleteMessages() {
  const cutoff = subDays(new Date(), MAX_MESSAGE_AGE_DAYS);

  logger.info(`[message-cleanup] Starting cleanup — cutoff: ${cutoff.toISOString()}`);

  // 1. Fetch storage keys before deleting
  // Get messagesIds
  let storageKeys: string[] = [];
  let messagesIds = [];

  try {
    const messagesToCleanup = await MessageRepository.findMessagesToCleanup(cutoff);

    messagesIds = messagesToCleanup.map((message) => message.id);

    storageKeys = messagesToCleanup.flatMap((message) =>
      message.attachments.map((attachment) => attachment.storageKey)
    );
  } catch (error) {
    logger.error('[message-cleanup] Failed to fetch messages to clean up, aborting job:', error);
    return;
  }

  if (messagesIds.length === 0) {
    logger.info('[message-cleanup] No messages to clean up.');
    return;
  }

  // 2. If a message is referenced as last_message in conversation table
  // mark it as null
  try {
    await MessageRepository.nullifyLastMessageReferences(messagesIds);
    logger.info('[message-cleanup] Cleared lastMessageId references for affected conversations.');
  } catch (error) {
    logger.error(
      '[message-cleanup] Failed to clear lastMessageId references, aborting job:',
      error
    );
    return;
  }

  // 3. Delete the files in R2 — if this fails, it's just logged and does NOT
  //    affect the job outcome: the messages were already deleted successfully.
  try {
    await storageService.deleteFiles(storageKeys);
    logger.info(`[message-cleanup] ${storageKeys.length} files deleted from R2.`);
  } catch (error) {
    logger.error(`[message-cleanup] Failed to delete files from R2: aborting job`, error);
    return;
  }

  // 4. Delete messages (attachments and deliveries are removed by DB cascade).
  try {
    let deletedMessages = 0;
    deletedMessages = await MessageRepository.deleteMessagesOlderThan(cutoff);
    logger.info(`[message-cleanup] ${deletedMessages} messages deleted from the DB.`);
  } catch (error) {
    logger.error('[message-cleanup] Failed to delete messages, aborting job:', error);
    return;
  }

  logger.info('[message-cleanup] Job finished.');
}

export const deleteMessagesJob = cron.schedule(CRON_EXPRESSION, deleteMessages, {
  timezone: 'America/Bogota',
});
