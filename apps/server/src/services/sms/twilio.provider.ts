import Twilio from 'twilio';
import { SmsProvider } from './sms.provider';
import { logger } from '../../config/logger';

export class TwilioProvider implements SmsProvider {
  private client: Twilio.Twilio | null = null;
  private phoneNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!accountSid || !authToken || !this.phoneNumber) {
      logger.warn('Twilio credentials not configured');
    } else {
      this.client = Twilio(accountSid, authToken);
      logger.info('Twilio SMS provider initialized');
    }
  }

  async sendSms(options: { to: string; text: string }): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio credentials not configured');
    }

    let to = options.to.replace(/-/g, '');
    if (!to.startsWith('+')) {
      if (to.startsWith('0')) {
        to = '+82' + to.slice(1);
      } else {
        to = '+' + to;
      }
    }

    try {
      const message = await this.client.messages.create({
        body: options.text,
        from: this.phoneNumber,
        to,
      });

      logger.info('SMS sent successfully via Twilio', {
        to: to.slice(0, 4) + '****' + to.slice(-4),
        sid: message.sid,
      });
    } catch (error) {
      logger.error('Twilio SMS send failed', {
        error: error instanceof Error ? error.message : String(error),
        to: to.slice(0, 4) + '****' + to.slice(-4),
      });
      throw new Error(`SMS send failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const twilioProvider = new TwilioProvider();
