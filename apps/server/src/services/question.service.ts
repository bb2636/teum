import { questionRepository } from '../repositories/question.repository';
import { logger } from '../config/logger';

export class QuestionService {
  async getAllQuestions() {
    logger.info('Fetching all questions');
    return questionRepository.findAllActive();
  }

  async getQuestionById(id: string) {
    logger.info('Fetching question', { id });
    const question = await questionRepository.findById(id);
    if (!question) {
      throw new Error('Question not found');
    }
    return question;
  }

  async createQuestion(data: { question: string; isActive?: boolean }) {
    logger.info('Creating question', { question: data.question.substring(0, 50) });
    return questionRepository.create(data);
  }

  async updateQuestion(id: string, data: { question?: string; isActive?: boolean }) {
    logger.info('Updating question', { id });
    const question = await questionRepository.findById(id);
    if (!question) {
      throw new Error('Question not found');
    }
    return questionRepository.update(id, data);
  }

  async deleteQuestion(id: string) {
    logger.info('Deleting question', { id });
    await questionRepository.delete(id);
  }

  async getRandomQuestions(userId: string, count: number = 3) {
    logger.info('Getting random questions for user', { userId, count });
    return questionRepository.getRandomQuestions(userId, count);
  }

  async recordQuestionUsage(userId: string, questionId: string, diaryId?: string) {
    logger.info('Recording question usage', { userId, questionId, diaryId });
    return questionRepository.recordQuestionUsage(userId, questionId, diaryId);
  }

  async updateQuestionOrder(questionIds: string[]) {
    logger.info('Updating question order', { questionIds });
    return questionRepository.updateOrder(questionIds);
  }
}

export const questionService = new QuestionService();
