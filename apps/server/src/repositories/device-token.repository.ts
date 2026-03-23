import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { deviceTokens } from '../db/schema/device-tokens';

export class DeviceTokenRepository {
  async upsertToken(userId: string, token: string, platform: 'android' | 'ios' | 'web') {
    await db
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.token, token)));

    const [inserted] = await db
      .insert(deviceTokens)
      .values({ userId, token, platform })
      .returning();

    return inserted;
  }

  async removeToken(userId: string, token: string) {
    await db
      .delete(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
  }

  async removeAllTokens(userId: string) {
    await db
      .delete(deviceTokens)
      .where(eq(deviceTokens.userId, userId));
  }

  async getTokensByUserId(userId: string) {
    return db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId));
  }
}

export const deviceTokenRepository = new DeviceTokenRepository();
