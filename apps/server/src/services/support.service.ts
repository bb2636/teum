import { supportRepository } from '../repositories/support.repository';
import { logger } from '../config/logger';
import { emailService } from './email/email.service';
import { userRepository } from '../repositories/user.repository';

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

    userRepository.findByIdWithProfile(userId).then(user => {
      if (user?.email) {
        const nickname = (user as any)?.profile?.nickname || '회원';
        emailService.sendInquirySubmittedNotification(user.email, nickname, data.subject).catch(() => {});
      }
    }).catch(() => {});

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

    const inquiryUserId = (inquiry as any).userId;
    if (inquiryUserId) {
      userRepository.findByIdWithProfile(inquiryUserId).then(user => {
        if (user?.email) {
          const nickname = (user as any)?.profile?.nickname || '회원';
          emailService.sendInquiryAnsweredNotification(user.email, nickname, (inquiry as any).subject || '문의').catch(() => {});
        }
      }).catch(() => {});
    }

    return updated;
  }
  async getUncheckedCount(): Promise<number> {
    return supportRepository.countUnchecked();
  }

  async markInquiriesChecked() {
    await supportRepository.markAllChecked();
    logger.info('Marked all unchecked inquiries as checked');
  }
}

export const supportService = new SupportService();
