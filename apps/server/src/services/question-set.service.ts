import { questionSetRepository } from '../repositories/question-set.repository';
import { logger } from '../config/logger';

export class QuestionSetService {
  async getActiveQuestionSets() {
    logger.info('Fetching active question sets');
    return questionSetRepository.findActive();
  }

  async getQuestionSetById(id: string) {
    logger.info('Fetching question set', { id });
    const questionSet = await questionSetRepository.findById(id);
    if (!questionSet) {
      throw new Error('Question set not found');
    }
    return questionSet;
  }
}

export const questionSetService = new QuestionSetService();
