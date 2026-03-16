import { supportRepository } from '../repositories/support.repository';
import { logger } from '../config/logger';

export class SupportService {
  async createInquiry(userId: string, data: {
    subject: string;
    message: string;
  }) {
    logger.info('Creating support inquiry', { userId });

    const inquiry = await supportRepository.create({
      userId,
      subject: data.subject,
      message: data.message,
    });

    return inquiry;
  }

  async getInquiries(userId: string) {
    return supportRepository.findByUserId(userId);
  }

  async getInquiry(id: string, userId: string) {
    const inquiry = await supportRepository.findById(id, userId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    return inquiry;
  }
}

export const supportService = new SupportService();
