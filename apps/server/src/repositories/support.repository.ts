import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db';
import { supportInquiries } from '../db/schema';

export class SupportRepository {
  async create(data: {
    userId: string;
    subject: string;
    message: string;
  }) {
    const [inquiry] = await db
      .insert(supportInquiries)
      .values({
        userId: data.userId,
        subject: data.subject,
        message: data.message,
        status: 'received',
      })
      .returning();
    return inquiry;
  }

  async findByUserId(userId: string) {
    return db
      .select()
      .from(supportInquiries)
      .where(
        and(
          eq(supportInquiries.userId, userId),
          isNull(supportInquiries.deletedAt)
        )
      )
      .orderBy(desc(supportInquiries.createdAt));
  }

  async findById(id: string, userId?: string) {
    const conditions = [eq(supportInquiries.id, id), isNull(supportInquiries.deletedAt)];
    if (userId) {
      conditions.push(eq(supportInquiries.userId, userId));
    }

    const [inquiry] = await db
      .select()
      .from(supportInquiries)
      .where(and(...conditions))
      .limit(1);
    return inquiry;
  }
}

export const supportRepository = new SupportRepository();
