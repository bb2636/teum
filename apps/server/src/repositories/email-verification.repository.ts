import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { emailVerifications } from '../db/schema';

export class EmailVerificationRepository {
  async create(data: {
    userId?: string;
    email: string;
    code: string;
    expiresAt: Date;
  }) {
    const [verification] = await db
      .insert(emailVerifications)
      .values({
        userId: data.userId,
        email: data.email,
        code: data.code,
        status: 'pending',
        expiresAt: data.expiresAt,
      })
      .returning();
    return verification;
  }

  async findValidCode(email: string, code: string) {
    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.code, code),
          eq(emailVerifications.status, 'pending'),
          gt(emailVerifications.expiresAt, new Date())
        )
      )
      .orderBy(emailVerifications.createdAt)
      .limit(1);
    return verification;
  }

  async markAsVerified(id: string) {
    await db
      .update(emailVerifications)
      .set({
        status: 'verified',
        verifiedAt: new Date(),
      })
      .where(eq(emailVerifications.id, id));
  }

  async markAsExpired(email: string) {
    await db
      .update(emailVerifications)
      .set({ status: 'expired' })
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.status, 'pending')
        )
      );
  }
}

export const emailVerificationRepository = new EmailVerificationRepository();
