import 'reflect-metadata';
import { createServer } from 'node:http';

import app from './app';
import { createWebSocketServer } from '@websocket/websocket-server';
import { registerGroupListeners } from '@events';
import { AppDataSource } from '@config/database';
import { env } from '@config/environment';
import { logger } from '@config/logger';
import { startJobs } from '@jobs';
import { reconcileCallsOnStartup } from './startup/reconcile-calls';

const startServer = async () => {
  try {
    // Init Database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connected successfully');
    }

    // Single-instance only: the previous process must be stopped.
    // Retry transient failures before accepting traffic or starting jobs.
    await reconcileCallsOnStartup();

    // Register server events.
    registerGroupListeners();

    // Start cron jobs
    startJobs();

    // Create the HTTP server.
    const server = createServer(app);

    // Attach the WebSocket server.
    createWebSocketServer({
      server,
    });

    server.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
};

void startServer();
