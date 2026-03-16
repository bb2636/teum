import nodemailer, { Transporter } from 'nodemailer';
import { EmailProvider } from './email.provider';
import { logger } from '../../config/logger';

/**
 * Nodemailer Email Provider
 * 
 * Implements email sending using Nodemailer.
 * Supports SMTP, Gmail, and other email services.
 */
export class NodemailerProvider implements EmailProvider {
  private transporter: Transporter | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.EMAIL_ENABLED === 'true';
    
    if (!this.enabled) {
      logger.warn('Email provider disabled - set EMAIL_ENABLED=true to enable');
      return;
    }

    // Initialize transporter based on configuration
    const emailService = process.env.EMAIL_SERVICE || 'smtp';
    
    if (emailService === 'gmail') {
      // Gmail OAuth2 or App Password
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD, // App Password for Gmail
        },
      });
    } else {
      // Generic SMTP
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD,
        },
      });
    }

    logger.info('Email provider initialized', { service: emailService });
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (!this.enabled || !this.transporter) {
      logger.warn('Email sending skipped - provider not enabled', { to: options.to });
      return;
    }

    try {
      const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@teum.com';
      
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      });

      logger.info('Email sent successfully', { to: options.to, subject: options.subject });
    } catch (error) {
      logger.error('Failed to send email', {
        to: options.to,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const nodemailerProvider = new NodemailerProvider();
