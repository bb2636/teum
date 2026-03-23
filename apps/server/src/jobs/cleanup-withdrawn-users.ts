import cron from 'node-cron';
import { db } from '../db';
import { users } from '../db/schema/users';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { logger } from '../config/logger';

async function purgeExpiredWithdrawnUsers() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  try {
    const expiredUsers = await db
      .select({ id: users.id, email: users.email, deletedAt: users.deletedAt })
      .from(users)
      .where(
        and(
          isNotNull(users.deletedAt),
          lte(users.deletedAt, oneYearAgo)
        )
      );

    if (expiredUsers.length === 0) {
      logger.info('No expired withdrawn users to purge');
      return;
    }

    logger.info(`Found ${expiredUsers.length} withdrawn users older than 1 year, purging...`);

    for (const user of expiredUsers) {
      try {
        await db.delete(users).where(eq(users.id, user.id));
        logger.info(`Purged withdrawn user: ${user.email} (deleted at: ${user.deletedAt})`);
      } catch (err) {
        logger.error(`Failed to purge user ${user.id}`, { error: err });
      }
    }

    logger.info(`Purge complete: ${expiredUsers.length} users processed`);
  } catch (err) {
    logger.error('Failed to run withdrawn user purge job', { error: err });
  }
}

export function startCleanupJob() {
  cron.schedule('0 3 * * *', () => {
    logger.info('Running daily withdrawn user cleanup job');
    purgeExpiredWithdrawnUsers();
  });

  logger.info('Withdrawn user cleanup job scheduled (daily at 03:00)');
}
