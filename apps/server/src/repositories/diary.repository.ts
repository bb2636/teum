import { eq, and, isNull, gte, lte, desc, inArray } from 'drizzle-orm';
import { db } from '../db';
import { diaries, diaryImages, diaryAnswers } from '../db/schema';
import { questions } from '../db/schema/questions';

export class DiaryRepository {
  async findAll() {
    // Optimized: Use single query with relations instead of N+1 queries
    const results = await db.query.diaries.findMany({
      where: (diaries, { isNull }) => isNull(diaries.deletedAt),
      orderBy: (diaries, { desc }) => [desc(diaries.date)],
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.sortOrder)],
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
      limit: 100, // Limit for admin view to prevent excessive data loading
    });

    // Enrich answers with question data from questions table if question is null
    // Collect all questionIds that need to be fetched from questions table
    const questionIdsToFetch: string[] = [];
    for (const diary of results) {
      if (diary.answers && diary.answers.length > 0) {
        for (const answer of diary.answers) {
          if (!answer.question && answer.questionId) {
            questionIdsToFetch.push(answer.questionId);
          }
        }
      }
    }

    // Fetch all questions in one query
    let questionsMap = new Map<string, typeof questions.$inferSelect>();
    if (questionIdsToFetch.length > 0) {
      const fetchedQuestions = await db
        .select()
        .from(questions)
        .where(and(inArray(questions.id, questionIdsToFetch), isNull(questions.deletedAt)));
      
      questionsMap = new Map(fetchedQuestions.map((q) => [q.id, q]));
    }

    // Enrich answers with question data
    for (const diary of results) {
      if (diary.answers && diary.answers.length > 0) {
        for (const answer of diary.answers) {
          if (!answer.question && answer.questionId) {
            const question = questionsMap.get(answer.questionId);
            if (question) {
              // Add question data to answer
              (answer as any).question = question;
            }
          }
        }
      }
    }

    return results;
  }

  async findByUserId(userId: string, folderId?: string) {
    // Optimized: Use single query with relations instead of N+1 queries
    const results = await db.query.diaries.findMany({
      where: (diaries, { eq, isNull, and: andFn }) => {
        const conditions = [
          eq(diaries.userId, userId),
          isNull(diaries.deletedAt),
        ];
        if (folderId) {
          conditions.push(eq(diaries.folderId, folderId));
        }
        return andFn(...conditions);
      },
      orderBy: (diaries, { desc }) => [desc(diaries.date)],
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.sortOrder)],
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
      },
    });

    // Enrich answers with question data from questions table if question is null
    for (const diary of results) {
      if (diary.answers && diary.answers.length > 0) {
        for (const answer of diary.answers) {
          // If question from diaryQuestions is null, try to get from questions table
          if (!answer.question && answer.questionId) {
            const question = await db.query.questions.findFirst({
              where: (questions, { eq, isNull: isNullFn }) =>
                and(eq(questions.id, answer.questionId), isNullFn(questions.deletedAt)),
            });
            if (question) {
              // Add question data to answer
              (answer as any).question = question;
            }
          }
        }
      }
    }

    return results;
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date) {
    const results = await db.query.diaries.findMany({
      where: (diaries, { eq, and: andFn, isNull: isNullFn, gte: gteFn, lte: lteFn }) =>
        andFn(
          eq(diaries.userId, userId),
          gteFn(diaries.date, startDate),
          lteFn(diaries.date, endDate),
          isNullFn(diaries.deletedAt)
        ),
      orderBy: (diaries, { desc: descFn }) => [descFn(diaries.date)],
      with: {
        folder: true,
        images: {
          orderBy: (images, { asc }) => [asc(images.sortOrder)],
        },
        answers: {
          with: {
            question: true,
          },
        },
      },
    });

    const questionIdsToFetch: string[] = [];
    for (const diary of results) {
      if (diary.answers && diary.answers.length > 0) {
        for (const answer of diary.answers) {
          if (!answer.question && answer.questionId) {
            questionIdsToFetch.push(answer.questionId);
          }
        }
      }
    }

    let questionsMap = new Map<string, typeof questions.$inferSelect>();
    if (questionIdsToFetch.length > 0) {
      const uniqueIds = [...new Set(questionIdsToFetch)];
      const fetchedQuestions = await db
        .select()
        .from(questions)
        .where(and(inArray(questions.id, uniqueIds), isNull(questions.deletedAt)));
      for (const q of fetchedQuestions) {
        questionsMap.set(q.id, q);
      }
    }

    for (const diary of results) {
      if (diary.answers && diary.answers.length > 0) {
        for (const answer of diary.answers) {
          if (!answer.question && answer.questionId) {
            const question = questionsMap.get(answer.questionId);
            if (question) {
              (answer as any).question = question;
            }
          }
        }
      }
    }

    return results;
  }

  async findById(id: string) {
    const diary = await db.query.diaries.findFirst({
      where: (diaries, { eq, and, isNull }) =>
        and(eq(diaries.id, id), isNull(diaries.deletedAt)),
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.sortOrder)],
        },
        answers: {
          with: {
            question: true, // May be null if question is from questions table
          },
        },
        aiFeedback: true,
      },
    });

    // Enrich answers with question data from questions table if question is null
    if (diary && diary.answers && diary.answers.length > 0) {
      // Collect all questionIds that need to be fetched
      const questionIdsToFetch = diary.answers
        .filter((answer) => !answer.question && answer.questionId)
        .map((answer) => answer.questionId);

      // Fetch all questions in one query
      let questionsMap = new Map<string, typeof questions.$inferSelect>();
      if (questionIdsToFetch.length > 0) {
        const fetchedQuestions = await db
          .select()
          .from(questions)
          .where(and(inArray(questions.id, questionIdsToFetch), isNull(questions.deletedAt)));
        
        questionsMap = new Map(fetchedQuestions.map((q) => [q.id, q]));
      }

      // Enrich answers with question data
      for (const answer of diary.answers) {
        if (!answer.question && answer.questionId) {
          const question = questionsMap.get(answer.questionId);
          if (question) {
            // Add question data to answer
            (answer as any).question = question;
          }
        }
      }
    }

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
          sortOrder: index,
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
