import { logger } from '@config/logger';
import type { ScheduledTask } from 'node-cron';

import { deleteMessagesJob } from './delete-messages.job';
import { expireCallsJob } from './expire-calls-job';

type Job = {
  name: string;
  instance: ScheduledTask;
};

const jobs: Job[] = [
  {
    name: 'Delete messages job',
    instance: deleteMessagesJob,
  },
  {
    name: 'Expire calls job',
    instance: expireCallsJob,
  },
];

export const startJobs = (): void => {
  if (jobs.length === 0) {
    logger.info('No jobs scheduled');
    return;
  }

  for (const { name, instance } of jobs) {
    instance.start();
    logger.info(`Job scheduled: ${name}`);
  }
};
