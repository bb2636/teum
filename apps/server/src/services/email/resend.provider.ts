import { Resend } from 'resend';
import { EmailProvider } from './email.provider';
import { logger } from '../../config/logger';

export class ResendProvider implements EmailProvider {
  private client: Resend | null = null;
  private enabled: boolean;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    this.enabled = !!apiKey;

    if (!this.enabled) {
      logger.warn('Resend email provider disabled - set RESEND_API_KEY to enable');
      return;
    }

    this.client = new Resend(apiKey);
    logger.info('Resend email provider initialized', { from: this.fromEmail });
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (!this.enabled || !this.client) {
      logger.warn('Email sending skipped - Resend not enabled', { to: options.to });
      return;
    }

    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        logger.error('Resend email send failed', {
          to: options.to,
          error: error.message,
        });
        throw new Error(`Failed to send email: ${error.message}`);
      }

      logger.info('Email sent successfully via Resend', {
        to: options.to,
        subject: options.subject,
        id: data?.id,
      });
    } catch (error) {
      logger.error('Failed to send email via Resend', {
        to: options.to,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const resendProvider = new ResendProvider();
