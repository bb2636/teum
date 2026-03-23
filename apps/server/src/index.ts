import 'dotenv/config';
import { app } from './app';
import { logger } from './config/logger';
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

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  startCleanupJob();
  startMusicPolling();
});
