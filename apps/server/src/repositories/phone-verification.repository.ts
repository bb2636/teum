import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { phoneVerifications } from '../db/schema';

export class PhoneVerificationRepository {
  async create(data: {
    userId?: string;
    phone: string;
    code: string;
    expiresAt: Date;
  }) {
    const [verification] = await db
      .insert(phoneVerifications)
      .values({
        userId: data.userId,
        phone: data.phone,
        code: data.code,
        status: 'pending',
        expiresAt: data.expiresAt,
      })
      .returning();
    return verification;
  }

  async findValidCode(phone: string, code: string) {
    const [verification] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.phone, phone),
          eq(phoneVerifications.code, code),
          eq(phoneVerifications.status, 'pending'),
          gt(phoneVerifications.expiresAt, new Date())
        )
      )
      .orderBy(phoneVerifications.createdAt)
      .limit(1);
    return verification;
  }

  async markAsVerified(id: string) {
    await db
      .update(phoneVerifications)
      .set({
        status: 'verified',
        verifiedAt: new Date(),
      })
      .where(eq(phoneVerifications.id, id));
  }

  async markAsExpired(phone: string) {
    await db
      .update(phoneVerifications)
      .set({ status: 'expired' })
      .where(
        and(
          eq(phoneVerifications.phone, phone),
          eq(phoneVerifications.status, 'pending')
        )
      );
  }
}

export const phoneVerificationRepository = new PhoneVerificationRepository();
