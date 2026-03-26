import crypto from 'crypto';
import { SmsProvider } from './sms.provider';
import { logger } from '../../config/logger';

export class SolapiProvider implements SmsProvider {
  private apiKey: string;
  private apiSecret: string;
  private senderNumber: string;
  private baseUrl = 'https://api.solapi.com';

  constructor() {
    this.apiKey = process.env.SOLAPI_API_KEY || '';
    this.apiSecret = process.env.SOLAPI_API_SECRET || '';
    this.senderNumber = process.env.SOLAPI_SENDER_NUMBER || '';

    if (!this.apiKey || !this.apiSecret || !this.senderNumber) {
      logger.warn('Solapi credentials not configured');
    } else {
      logger.info('Solapi SMS provider initialized');
    }
  }

  private generateAuthHeader(): string {
    const date = new Date().toISOString();
    const salt = crypto.randomUUID();
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(date + salt)
      .digest('hex');
    return `HMAC-SHA256 apiKey=${this.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  }

  async sendSms(options: { to: string; text: string }): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Solapi credentials not configured');
    }

    const to = options.to.replace(/-/g, '');

    const body = {
      message: {
        to,
        from: this.senderNumber,
        text: options.text,
      },
    };

    const response = await fetch(`${this.baseUrl}/messages/v4/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.generateAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Solapi SMS send failed', {
        status: response.status,
        body: errorBody,
        to,
      });
      throw new Error(`SMS send failed: ${response.status} ${errorBody}`);
    }

    const result = await response.json();
    logger.info('SMS sent successfully via Solapi', {
      to,
      groupId: result.groupId,
    });
  }
}

export const solapiProvider = new SolapiProvider();
