import 'reflect-metadata';
import { createServer } from 'node:http';

import app from './app';
import { createWebSocketServer } from './websocket/websocket-server';
import { AppDataSource } from '@config/database';
import { env } from '@config/environment';
import { logger } from '@config/logger';
import { startJobs } from '@jobs';

const startServer = async () => {
  try {
    // Init Database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connected successfully');
    }

    // Start cron jobs
    startJobs();

    // HTTP server
    const server = createServer(app);

    // WS server
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

startServer();
