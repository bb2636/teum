import { eq, and, isNull, notInArray, sql, desc, gte, asc } from 'drizzle-orm';
import { db } from '../db';
import { questions, userQuestionHistory } from '../db/schema';

export class QuestionRepository {
  async findAllActive() {
    return db
      .select()
      .from(questions)
      .where(and(eq(questions.isActive, true), isNull(questions.deletedAt)))
      .orderBy(asc(questions.order), desc(questions.createdAt));
  }

  async findById(id: string) {
    const [question] = await db
      .select()
      .from(questions)
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
      .limit(1);
    return question;
  }

  async create(data: { question: string; isActive?: boolean; order?: number }) {
    // Get max order value
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${questions.order}), 0)` })
      .from(questions)
      .where(isNull(questions.deletedAt));
    
    const maxOrder = maxOrderResult[0]?.maxOrder ?? 0;
    const newOrder = data.order ?? maxOrder + 1;

    const [question] = await db
      .insert(questions)
      .values({
        question: data.question,
        isActive: data.isActive ?? true,
        order: newOrder,
      })
      .returning();
    return question;
  }

  async update(id: string, data: { question?: string; isActive?: boolean; order?: number }) {
    const [question] = await db
      .update(questions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id))
      .returning();
    return question;
  }

  async updateOrder(questionIds: string[]) {
    // Update order for all questions in the provided order
    const updates = questionIds.map((id, index) =>
      db
        .update(questions)
        .set({ order: index + 1, updatedAt: new Date() })
        .where(eq(questions.id, id))
    );
    
    await Promise.all(updates);
    
    // Return all active questions in updated order
    return this.findAllActive();
  }

  async delete(id: string) {
    await db
      .update(questions)
      .set({ deletedAt: new Date() })
      .where(eq(questions.id, id));
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
      .orderBy(asc(questions.order));

    // If we don't have enough questions after filtering, use all active questions
    const availableQuestions =
      allQuestions.length < count
        ? await db
            .select()
            .from(questions)
            .where(and(eq(questions.isActive, true), isNull(questions.deletedAt)))
            .orderBy(asc(questions.order))
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
