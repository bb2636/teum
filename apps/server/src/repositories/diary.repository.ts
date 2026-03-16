import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import { diaries, diaryImages, diaryAnswers, diaryQuestions } from '../db/schema';

export class DiaryRepository {
  async findAll() {
    const results = await db
      .select()
      .from(diaries)
      .where(isNull(diaries.deletedAt))
      .orderBy(desc(diaries.date));

    // Load relations for each diary
    const diariesWithRelations = await Promise.all(
      results.map(async (diary) => {
        try {
          const fullDiary = await db.query.diaries.findFirst({
            where: (diaries, { eq }) => eq(diaries.id, diary.id),
            with: {
              images: {
                orderBy: (images, { asc }) => [asc(images.order)],
              },
              answers: {
                with: {
                  question: true, // May be null if question is from questions table
                },
              },
              aiFeedback: {
                orderBy: (feedback, { desc }) => [desc(feedback.createdAt)],
                limit: 1,
              },
              user: {
                with: {
                  profile: true,
                },
              },
              folder: true,
            },
          });
          return fullDiary || diary;
        } catch (error) {
          // If relation fails (e.g., question from questions table), return diary without answers
          console.error(`Error loading diary ${diary.id} relations:`, error);
          return diary;
        }
      })
    );

    return diariesWithRelations.filter((d) => d !== null);
  }

  async findByUserId(userId: string, folderId?: string) {
    const conditions = [
      eq(diaries.userId, userId),
      isNull(diaries.deletedAt),
    ];

    if (folderId) {
      conditions.push(eq(diaries.folderId, folderId));
    }

    const results = await db
      .select()
      .from(diaries)
      .where(and(...conditions))
      .orderBy(desc(diaries.date));

    // Load relations for each diary
    const diariesWithRelations = await Promise.all(
      results.map(async (diary) => {
        const fullDiary = await db.query.diaries.findFirst({
          where: (diaries, { eq }) => eq(diaries.id, diary.id),
          with: {
            images: {
              orderBy: (images, { asc }) => [asc(images.order)],
            },
            answers: {
              with: {
                question: true,
              },
            },
            aiFeedback: {
              orderBy: (feedback, { desc }) => [desc(feedback.createdAt)],
              limit: 1,
            },
          },
        });
        return fullDiary || diary;
      })
    );

    return diariesWithRelations.filter((d) => d !== null);
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date) {
    return db
      .select()
      .from(diaries)
      .where(
        and(
          eq(diaries.userId, userId),
          gte(diaries.date, startDate),
          lte(diaries.date, endDate),
          isNull(diaries.deletedAt)
        )
      )
      .orderBy(desc(diaries.date));
  }

  async findById(id: string) {
    const diary = await db.query.diaries.findFirst({
      where: (diaries, { eq, and, isNull }) =>
        and(eq(diaries.id, id), isNull(diaries.deletedAt)),
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.order)],
        },
        answers: {
          with: {
            question: true,
          },
        },
        aiFeedback: true,
      },
    });
    return diary;
  }

  async create(data: {
    userId: string;
    folderId?: string;
    type: 'free_form' | 'question_based';
    title?: string;
    content?: string;
    textStyle?: string;
    date: Date;
  }) {
    const [diary] = await db
      .insert(diaries)
      .values({
        userId: data.userId,
        folderId: data.folderId,
        type: data.type,
        title: data.title,
        content: data.content,
        textStyle: data.textStyle,
        date: data.date,
      })
      .returning();
    return diary;
  }

  async update(id: string, data: {
    folderId?: string;
    title?: string;
    content?: string;
    textStyle?: string;
    date?: Date;
  }) {
    const [diary] = await db
      .update(diaries)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(diaries.id, id))
      .returning();
    return diary;
  }

  async delete(id: string) {
    await db
      .update(diaries)
      .set({ deletedAt: new Date() })
      .where(eq(diaries.id, id));
  }

  async createImages(diaryId: string, imageUrls: string[]) {
    if (imageUrls.length === 0) return [];

    const images = await db
      .insert(diaryImages)
      .values(
        imageUrls.map((url, index) => ({
          diaryId,
          imageUrl: url,
          order: index,
        }))
      )
      .returning();
    return images;
  }

  async deleteImages(diaryId: string) {
    await db
      .delete(diaryImages)
      .where(eq(diaryImages.diaryId, diaryId));
  }

  async createAnswers(diaryId: string, answers: Array<{ questionId: string; answer: string }>) {
    if (answers.length === 0) return [];

    const createdAnswers = await db
      .insert(diaryAnswers)
      .values(
        answers.map((item) => ({
          diaryId,
          questionId: item.questionId,
          answer: item.answer,
        }))
      )
      .returning();
    return createdAnswers;
  }

  async deleteAnswers(diaryId: string) {
    await db
      .delete(diaryAnswers)
      .where(eq(diaryAnswers.diaryId, diaryId));
  }

  async findAnswersByDiaryId(diaryId: string) {
    return db.query.diaryAnswers.findMany({
      where: (answers, { eq }) => eq(answers.diaryId, diaryId),
      with: {
        question: true,
      },
    });
  }
}

export const diaryRepository = new DiaryRepository();
