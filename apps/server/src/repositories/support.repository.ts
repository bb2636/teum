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

    const inquiry = await db.query.supportInquiries.findFirst({
      where: (inquiries, { eq, and, isNull }) => {
        const whereConditions = [eq(inquiries.id, id), isNull(inquiries.deletedAt)];
        if (userId) {
          whereConditions.push(eq(inquiries.userId, userId));
        }
        return and(...whereConditions);
      },
      with: {
        user: {
          with: {
            profile: true,
          },
        },
      },
    });
    return inquiry;
  }

  async findAll() {
    const inquiries = await db
      .select()
      .from(supportInquiries)
      .where(isNull(supportInquiries.deletedAt))
      .orderBy(desc(supportInquiries.createdAt));

    // Load user relations for each inquiry
    const inquiriesWithUsers = await Promise.all(
      inquiries.map(async (inquiry) => {
        const fullInquiry = await db.query.supportInquiries.findFirst({
          where: (inquiries, { eq }) => eq(inquiries.id, inquiry.id),
          with: {
            user: {
              with: {
                profile: true,
              },
            },
          },
        });
        return fullInquiry || inquiry;
      })
    );

    return inquiriesWithUsers;
  }

  async updateAnswer(id: string, answer: string, answeredBy: string) {
    const [inquiry] = await db
      .update(supportInquiries)
      .set({
        answer,
        answeredBy,
        answeredAt: new Date(),
        status: 'answered',
        updatedAt: new Date(),
      })
      .where(eq(supportInquiries.id, id))
      .returning();
    return inquiry;
  }
}

export const supportRepository = new SupportRepository();
