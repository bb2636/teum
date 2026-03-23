import 'dotenv/config';
import { app } from './app';
import { logger } from './config/logger';
import { startCleanupJob } from './jobs/cleanup-withdrawn-users';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  startCleanupJob();
});
