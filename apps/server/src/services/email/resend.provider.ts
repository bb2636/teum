import { Resend } from 'resend';
import { EmailProvider } from './email.provider';
import { logger } from '../../config/logger';

export class ResendProvider implements EmailProvider {
  private client: Resend | null = null;
  private enabled: boolean;
  private fromEmail: string;
  private replyTo: string | undefined;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const explicitReplyTo = process.env.RESEND_REPLY_TO?.trim();
    this.replyTo = explicitReplyTo || this.deriveNoReplyAddress(this.fromEmail);
    this.enabled = !!apiKey;

    if (!this.enabled) {
      logger.warn('Resend email provider disabled - set RESEND_API_KEY to enable');
      return;
    }

    this.client = new Resend(apiKey);
    if (!this.replyTo) {
      logger.warn('Resend reply_to could not be derived from RESEND_FROM_EMAIL; replies will go to from address. Set RESEND_REPLY_TO to enforce no-reply.', { from: this.fromEmail });
    }
    logger.info('Resend email provider initialized', { from: this.fromEmail, replyTo: this.replyTo });
  }

  // "Display Name <user@domain>" 또는 "user@domain" 모두 지원.
  // 도메인 추출 실패 시 undefined 반환 → 발송은 정상 진행, reply_to만 미적용.
  private deriveNoReplyAddress(fromAddress: string): string | undefined {
    const trimmed = fromAddress.trim();
    const bracketMatch = trimmed.match(/<([^>]+)>/);
    const email = (bracketMatch ? bracketMatch[1] : trimmed).trim();
    const atIdx = email.lastIndexOf('@');
    if (atIdx <= 0 || atIdx === email.length - 1) return undefined;
    const domain = email.slice(atIdx + 1).trim();
    if (!domain.includes('.')) return undefined;
    return `noreply@${domain}`;
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
        replyTo: this.replyTo,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
          'Precedence': 'bulk',
        },
      });

      if (error) {
        logger.error('Resend email send failed', {
          to: options.to,
          from: this.fromEmail,
          error: error.message,
          errorName: error.name,
          errorDetails: JSON.stringify(error),
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
