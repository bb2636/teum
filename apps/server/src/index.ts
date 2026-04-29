import 'dotenv/config';
import { app } from './app';
import { logger } from './config/logger';
import { sqlClient } from './db';
import { startCleanupJob } from './jobs/cleanup-withdrawn-users';
import { musicPollingService } from './services/music/music-polling.service';
import { paymentService } from './services/payment.service';

const PORT = process.env.PORT || 3001;

const MUSIC_POLL_INTERVAL = 10_000;
let musicPollTimer: NodeJS.Timeout | null = null;

function startMusicPolling() {
  if (musicPollTimer) return;
  musicPollTimer = setInterval(async () => {
    try {
      await musicPollingService.pollAllPendingJobs();
    } catch (err) {
      logger.error(
        {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        'Music polling error'
      );
    }
  }, MUSIC_POLL_INTERVAL);
  logger.info('Music polling worker started', { intervalMs: MUSIC_POLL_INTERVAL });
}

const AUTO_RENEWAL_INTERVAL = 60 * 60 * 1000;
let autoRenewalTimer: NodeJS.Timeout | null = null;

function startAutoRenewal() {
  if (autoRenewalTimer) return;
  autoRenewalTimer = setInterval(async () => {
    try {
      await paymentService.processAutoRenewals();
    } catch (err) {
      logger.error(
        {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        'Auto-renewal scheduler error'
      );
    }
  }, AUTO_RENEWAL_INTERVAL);
  logger.info('Auto-renewal scheduler started (every 1 hour)');
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
  startAutoRenewal();
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

  if (autoRenewalTimer) {
    clearInterval(autoRenewalTimer);
    autoRenewalTimer = null;
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
