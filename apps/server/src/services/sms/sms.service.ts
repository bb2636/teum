import { SmsProvider } from './sms.provider';
import { twilioProvider } from './twilio.provider';
import { logger } from '../../config/logger';

export class SmsService {
  private provider: SmsProvider;

  constructor(provider: SmsProvider = twilioProvider) {
    this.provider = provider;
  }

  async sendVerificationCode(phoneNumber: string, code: string): Promise<void> {
    const text = `[teum] 인증번호는 [${code}]입니다. 5분 이내에 입력해주세요.`;

    try {
      await this.provider.sendSms({ to: phoneNumber, text });
      logger.info('Verification SMS sent', { phoneNumber: phoneNumber.slice(-4) });
    } catch (error) {
      logger.error('Failed to send verification SMS', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async sendNotification(phoneNumber: string, message: string): Promise<void> {
    const text = `[teum] ${message}`;

    try {
      await this.provider.sendSms({ to: phoneNumber, text });
      logger.info('Notification SMS sent', { phoneNumber: phoneNumber.slice(-4) });
    } catch (error) {
      logger.error('Failed to send notification SMS', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async sendRaw(phoneNumber: string, text: string): Promise<void> {
    try {
      await this.provider.sendSms({ to: phoneNumber, text });
      logger.info('Raw SMS sent', { phoneNumber: phoneNumber.slice(-4) });
    } catch (error) {
      logger.error('Failed to send raw SMS', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const smsService = new SmsService();
