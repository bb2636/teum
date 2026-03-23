import { supportRepository } from '../repositories/support.repository';
import { logger } from '../config/logger';
import { pushNotificationService } from './push-notification.service';

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

  async getAllInquiries() {
    logger.info('Fetching all support inquiries for admin');
    return supportRepository.findAll();
  }

  async getInquiryById(id: string) {
    logger.info('Fetching inquiry by ID', { id });
    const inquiry = await supportRepository.findById(id);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    return inquiry;
  }

  async updateInquiryAnswer(id: string, answer: string, answeredBy: string) {
    logger.info('Updating inquiry answer', { id, answeredBy });
    const inquiry = await supportRepository.findById(id);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    const updated = await supportRepository.updateAnswer(id, answer, answeredBy);

    pushNotificationService.sendToUser(inquiry.userId, {
      title: '문의 답변이 도착했습니다',
      body: inquiry.subject,
      data: { type: 'inquiry_reply', inquiryId: id },
    }).catch((err) => {
      logger.error('Failed to send inquiry reply push notification', { inquiryId: id, error: err });
    });

    return updated;
  }
}

export const supportService = new SupportService();
