import { eq, and, isNull, notInArray, desc, gte, asc } from 'drizzle-orm';
import { db, sqlClient } from '../db';
import { logger } from '../config/logger';
import { questions, userQuestionHistory } from '../db/schema';

export class QuestionRepository {
  async findAllActive() {
    return db
      .select()
      .from(questions)
      .where(and(eq(questions.isActive, true), isNull(questions.deletedAt)))
      .orderBy(asc(questions.sortOrder), desc(questions.createdAt));
  }

  async findById(id: string) {
    const [question] = await db
      .select()
      .from(questions)
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
      .limit(1);
    return question;
  }

  async create(data: { question: string; isActive?: boolean; sortOrder?: number }) {
    const rows = await db
      .select({ sortOrder: questions.sortOrder })
      .from(questions)
      .where(isNull(questions.deletedAt));
    const maxOrder = rows.length ? Math.max(0, ...rows.map((r) => r.sortOrder)) : 0;
    const newSortOrder = data.sortOrder ?? maxOrder + 1;

    const [question] = await db
      .insert(questions)
      .values({
        question: data.question,
        isActive: data.isActive ?? true,
        sortOrder: newSortOrder,
      })
      .returning();
    return question;
  }

  async update(id: string, data: { question?: string; isActive?: boolean; sortOrder?: number }) {
    // question: postgres.js raw SQL로 직접 업데이트
    if (data.question !== undefined) {
      const rows = await sqlClient`
        UPDATE questions SET question = ${data.question}, updated_at = NOW()
        WHERE id = ${id} AND deleted_at IS NULL
        RETURNING id
      `;
      if (rows.length === 0) {
        logger.warn('Question update (raw) affected 0 rows', { id });
      }
    }
    // isActive, sortOrder: Drizzle 사용
    if (data.isActive !== undefined || data.sortOrder !== undefined) {
      const setValues = {
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        updatedAt: new Date(),
      };
      await db.update(questions).set(setValues).where(eq(questions.id, id));
    }
    const result = await this.findById(id);
    if (!result) {
      logger.warn('Question not found after update', { id });
      throw new Error('Question not found');
    }
    logger.info('Question update done', { id, dbQuestion: result.question });
    return result;
  }

  async updateOrder(questionIds: string[]) {
    // Update order for all questions in the provided order
    const updates = questionIds.map((id, index) =>
      db
        .update(questions)
        .set({ sortOrder: index + 1, updatedAt: new Date() })
        .where(eq(questions.id, id))
    );
    
    await Promise.all(updates);
    
    // Return all active questions in updated order
    return this.findAllActive();
  }

  async delete(id: string) {
    // 하드 삭제 - DB에서 완전히 제거 (user_question_history는 FK ON DELETE CASCADE로 자동 삭제)
    await db.delete(questions).where(eq(questions.id, id));
  }

  /**
   * Get random questions excluding those used by user in last 7 days
   * @param userId User ID
   * @param count Number of questions to return (default: 3)
   * @returns Array of questions
   */
  async getRandomQuestions(userId: string, count: number = 3) {
    // Get question IDs used by user in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentQuestions = await db
      .select({ questionId: userQuestionHistory.questionId })
      .from(userQuestionHistory)
      .where(
        and(
          eq(userQuestionHistory.userId, userId),
          gte(userQuestionHistory.createdAt, sevenDaysAgo)
        )
      );

    const excludedQuestionIds = recentQuestions.map((r) => r.questionId);

    // Get all active questions excluding recent ones, ordered by order field
    const conditions = [eq(questions.isActive, true), isNull(questions.deletedAt)];
    
    // If there are excluded questions, filter them out
    if (excludedQuestionIds.length > 0) {
      conditions.push(notInArray(questions.id, excludedQuestionIds));
    }

    const allQuestions = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(asc(questions.sortOrder));

    // If we don't have enough questions after filtering, use all active questions
    const availableQuestions =
      allQuestions.length < count
        ? await db
            .select()
            .from(questions)
            .where(and(eq(questions.isActive, true), isNull(questions.deletedAt)))
            .orderBy(asc(questions.sortOrder))
        : allQuestions;

    // Return first 'count' questions in order (no shuffling - use order field)
    return availableQuestions.slice(0, count);
  }

  /**
   * Record that a user has seen/answered a question
   */
  async recordQuestionUsage(
    userId: string,
    questionId: string,
    diaryId?: string
  ) {
    const [history] = await db
      .insert(userQuestionHistory)
      .values({
        userId,
        questionId,
        diaryId,
      })
      .returning();
    return history;
  }
}

export const questionRepository = new QuestionRepository();
