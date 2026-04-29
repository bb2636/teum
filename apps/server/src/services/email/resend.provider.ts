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

  // 본문 끝에 자동 삽입되는 발신 전용 안내문(한/영). 어떤 메일 템플릿에서도 동일하게 노출.
  // 주석 마커(__NO_REPLY_NOTICE__)로 중복 삽입 방지.
  private static readonly NO_REPLY_NOTICE_HTML = `
<!-- __NO_REPLY_NOTICE__ -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid #e5e7eb;">
  <tr>
    <td style="padding:16px 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b7280;">
      이 메일은 발신 전용입니다. 답장은 처리되지 않습니다.<br/>
      This is an automated email. Replies to this address are not monitored.
    </td>
  </tr>
</table>`;

  private static readonly NO_REPLY_NOTICE_TEXT =
    '\n\n----\n이 메일은 발신 전용입니다. 답장은 처리되지 않습니다.\nThis is an automated email. Replies to this address are not monitored.\n';

  // </body> 직전에 안내문을 끼워 넣는다. </body>가 없으면 끝에 그냥 붙임.
  // 마커(__NO_REPLY_NOTICE__) 또는 동일 본문 텍스트가 이미 있으면 중복 삽입하지 않음.
  private appendHtmlNotice(html: string): string {
    if (!html) return ResendProvider.NO_REPLY_NOTICE_HTML;
    if (
      html.includes('__NO_REPLY_NOTICE__') ||
      html.includes('이 메일은 발신 전용입니다')
    ) {
      return html;
    }
    const closingBody = /<\/body\s*>/i;
    if (closingBody.test(html)) {
      return html.replace(closingBody, `${ResendProvider.NO_REPLY_NOTICE_HTML}</body>`);
    }
    return `${html}${ResendProvider.NO_REPLY_NOTICE_HTML}`;
  }

  private appendTextNotice(text: string | undefined): string | undefined {
    if (text === undefined) return undefined;
    if (text.includes('이 메일은 발신 전용입니다')) return text;
    return `${text}${ResendProvider.NO_REPLY_NOTICE_TEXT}`;
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

    const htmlWithNotice = this.appendHtmlNotice(options.html);
    const textWithNotice = this.appendTextNotice(options.text);

    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: options.to,
        replyTo: this.replyTo,
        subject: options.subject,
        html: htmlWithNotice,
        text: textWithNotice,
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
