import { eq, and, gt, sql } from 'drizzle-orm';
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

  async findPendingByPhone(phone: string) {
    const [verification] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.phone, phone),
          eq(phoneVerifications.status, 'pending'),
          gt(phoneVerifications.expiresAt, new Date())
        )
      )
      .orderBy(phoneVerifications.createdAt)
      .limit(1);
    return verification;
  }

  async incrementFailedAttempts(id: string) {
    const [updated] = await db
      .update(phoneVerifications)
      .set({
        failedAttempts: sql`${phoneVerifications.failedAttempts} + 1`,
      })
      .where(eq(phoneVerifications.id, id))
      .returning();
    return updated;
  }

  async lockVerification(id: string) {
    const lockedUntil = new Date();
    lockedUntil.setHours(lockedUntil.getHours() + 1);
    await db
      .update(phoneVerifications)
      .set({
        lockedUntil,
        status: 'expired',
      })
      .where(eq(phoneVerifications.id, id));
  }

  async isPhoneLocked(phone: string): Promise<{ locked: boolean; lockedUntil?: Date }> {
    const [record] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.phone, phone),
          gt(phoneVerifications.lockedUntil, new Date())
        )
      )
      .limit(1);
    if (record && record.lockedUntil) {
      return { locked: true, lockedUntil: record.lockedUntil };
    }
    return { locked: false };
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

  async findRecentVerified(phone: string, withinMinutes: number = 10) {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - withinMinutes);
    const [verification] = await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.phone, phone),
          eq(phoneVerifications.status, 'verified'),
          gt(phoneVerifications.verifiedAt, cutoff)
        )
      )
      .limit(1);
    return verification;
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
