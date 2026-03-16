import { eq, and, gt, isNull } from 'drizzle-orm';
import { db } from '../db';
import { passwordResetTokens, users } from '../db/schema';

export class PasswordResetRepository {
  async createToken(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }) {
    // Invalidate any existing tokens for this user
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(
        and(
          eq(passwordResetTokens.userId, data.userId),
          eq(passwordResetTokens.used, false)
        )
      );

    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values({
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
        used: false,
      })
      .returning();
    return resetToken;
  }

  async findValidToken(token: string) {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    return resetToken;
  }

  async markAsUsed(token: string) {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async findUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return user;
  }
}

export const passwordResetRepository = new PasswordResetRepository();
