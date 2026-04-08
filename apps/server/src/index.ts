import 'dotenv/config';
import { app } from './app';
import { logger } from './config/logger';
import { sqlClient } from './db';
import { startCleanupJob } from './jobs/cleanup-withdrawn-users';
import { musicPollingService } from './services/music/music-polling.service';

const PORT = process.env.PORT || 3001;

const MUSIC_POLL_INTERVAL = 10_000;
let musicPollTimer: NodeJS.Timeout | null = null;

function startMusicPolling() {
  if (musicPollTimer) return;
  musicPollTimer = setInterval(async () => {
    try {
      await musicPollingService.pollAllPendingJobs();
    } catch (err) {
      logger.error('Music polling error', { error: err instanceof Error ? err.message : String(err) });
    }
  }, MUSIC_POLL_INTERVAL);
  logger.info('Music polling worker started', { intervalMs: MUSIC_POLL_INTERVAL });
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  gracefulShutdown('uncaughtException');
});

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  startCleanupJob();
  startMusicPolling();
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Graceful shutdown initiated (${signal})`);

  if (musicPollTimer) {
    clearInterval(musicPollTimer);
    musicPollTimer = null;
  }

  server.close(async () => {
    try {
      await sqlClient.end();
      logger.info('Database connections closed');
    } catch (err) {
      logger.error('Error closing database connections', { error: err });
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
