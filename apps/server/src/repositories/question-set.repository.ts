import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { diaryQuestionSets } from '../db/schema';

export class QuestionSetRepository {
  async findActive() {
    return db.query.diaryQuestionSets.findMany({
      where: (sets, { eq, and, isNull }) =>
        and(eq(sets.isActive, true), isNull(sets.deletedAt)),
      with: {
        questions: {
          orderBy: (questions, { asc }) => [asc(questions.order)],
        },
      },
    });
  }

  async findById(id: string) {
    const set = await db.query.diaryQuestionSets.findFirst({
      where: (sets, { eq, and, isNull }) =>
        and(eq(sets.id, id), isNull(sets.deletedAt)),
      with: {
        questions: {
          orderBy: (questions, { asc }) => [asc(questions.order)],
        },
      },
    });
    return set;
  }
}

export const questionSetRepository = new QuestionSetRepository();
