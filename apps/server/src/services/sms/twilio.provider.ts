import Twilio from 'twilio';
import { SmsProvider } from './sms.provider';
import { logger } from '../../config/logger';

export class TwilioProvider implements SmsProvider {
  private client: Twilio.Twilio | null = null;
  private phoneNumber: string;
  private verifyServiceSid: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || '';

    if (!accountSid || !authToken || !this.phoneNumber) {
      logger.warn('Twilio credentials not configured');
    } else {
      this.client = Twilio(accountSid, authToken);
      logger.info('Twilio SMS provider initialized', {
        verifyEnabled: !!this.verifyServiceSid,
      });
    }
  }

  private normalizePhone(input: string): string {
    let to = input.replace(/-/g, '').replace(/\s/g, '');
    if (!to.startsWith('+')) {
      if (to.startsWith('0')) {
        to = '+82' + to.slice(1);
      } else {
        to = '+' + to;
      }
    }
    return to;
  }

  async sendVerification(to: string): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio credentials not configured');
    }
    if (!this.verifyServiceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
    }

    const phone = this.normalizePhone(to);
    try {
      const verification = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({ to: phone, channel: 'sms' });

      logger.info('Twilio Verify sent', {
        to: phone.slice(0, 4) + '****' + phone.slice(-4),
        sid: verification.sid,
        status: verification.status,
      });
    } catch (error) {
      logger.error('Twilio Verify send failed', {
        error: error instanceof Error ? error.message : String(error),
        to: phone.slice(0, 4) + '****' + phone.slice(-4),
      });
      throw new Error(`Verification send failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async checkVerification(to: string, code: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Twilio credentials not configured');
    }
    if (!this.verifyServiceSid) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
    }

    const phone = this.normalizePhone(to);
    try {
      const check = await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({ to: phone, code });

      logger.info('Twilio Verify checked', {
        to: phone.slice(0, 4) + '****' + phone.slice(-4),
        status: check.status,
        valid: check.valid,
      });

      return check.status === 'approved' && check.valid === true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 404 = no pending verification (expired/already consumed) → treat as invalid
      if (message.includes('404') || message.toLowerCase().includes('not found')) {
        logger.warn('Twilio Verify check: no pending verification', {
          to: phone.slice(0, 4) + '****' + phone.slice(-4),
        });
        return false;
      }
      logger.error('Twilio Verify check failed', {
        error: message,
        to: phone.slice(0, 4) + '****' + phone.slice(-4),
      });
      throw new Error(`Verification check failed: ${message}`);
    }
  }

  async sendSms(options: { to: string; text: string }): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio credentials not configured');
    }

    const to = this.normalizePhone(options.to);

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
