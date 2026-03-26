import { EmailProvider } from './email.provider';
import { resendProvider } from './resend.provider';
import { logger } from '../../config/logger';

function getDefaultProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) {
    return resendProvider;
  }
  const { nodemailerProvider } = require('./nodemailer.provider');
  return nodemailerProvider;
}

/**
 * Email Service
 * 
 * High-level email sending service.
 * Provides email templates and business logic for email sending.
 */
export class EmailService {
  private provider: EmailProvider;

  constructor(provider: EmailProvider = getDefaultProvider()) {
    this.provider = provider;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>비밀번호 재설정</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8B4513; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">teum</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">기록이 곧, 당신만의 트랙이 됩니다</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #8B4513; margin-top: 0;">비밀번호 재설정 요청</h2>
            
            <p>안녕하세요,</p>
            
            <p>비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새 비밀번호를 설정해주세요.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background-color: #8B4513; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                비밀번호 재설정하기
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              또는 아래 링크를 브라우저에 직접 붙여넣으세요:<br>
              <a href="${resetLink}" style="color: #8B4513; word-break: break-all;">${resetLink}</a>
            </p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ 보안 안내</strong><br>
                • 이 링크는 1시간 동안만 유효합니다.<br>
                • 본인이 요청하지 않았다면 이 이메일을 무시하세요.<br>
                • 비밀번호는 안전하게 보관하세요.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
              문의사항이 있으시면 고객지원으로 연락해주세요.<br>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my" style="color: #8B4513;">고객지원 문의하기</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} teum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
teum - 비밀번호 재설정 요청

안녕하세요,

비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새 비밀번호를 설정해주세요.

${resetLink}

⚠️ 보안 안내
• 이 링크는 1시간 동안만 유효합니다.
• 본인이 요청하지 않았다면 이 이메일을 무시하세요.
• 비밀번호는 안전하게 보관하세요.

문의사항이 있으시면 고객지원으로 연락해주세요.

© ${new Date().getFullYear()} teum. All rights reserved.
    `;

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 비밀번호 재설정 요청',
        html,
        text,
      });
    } catch (error) {
      logger.error('Failed to send password reset email', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Send welcome email (optional)
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>teum에 오신 것을 환영합니다</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8B4513; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">teum</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">기록이 곧, 당신만의 트랙이 됩니다</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #8B4513; margin-top: 0;">환영합니다, ${name}님!</h2>
            
            <p>teum에 가입해주셔서 감사합니다.</p>
            
            <p>이제 일기를 작성하고, 감정을 기록하며, 나만의 음악을 만들어보세요.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="display: inline-block; background-color: #8B4513; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                시작하기
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} teum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 가입을 환영합니다',
        html,
      });
    } catch (error) {
      logger.error('Failed to send welcome email', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - welcome email is not critical
    }
  }
  async sendVerificationCodeEmail(email: string, code: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>이메일 인증</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8B4513; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">teum</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">기록이 곧, 당신만의 트랙이 됩니다</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #8B4513; margin-top: 0;">이메일 인증번호</h2>
            
            <p>안녕하세요,</p>
            <p>아래 인증번호를 입력하여 이메일 인증을 완료해주세요.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #f5ede4; border: 2px solid #8B4513; padding: 16px 40px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #4A2C1A;">
                ${code}
              </div>
            </div>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                이 인증번호는 5분 동안 유효합니다.<br>
                본인이 요청하지 않았다면 이 이메일을 무시하세요.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} teum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `[teum] 이메일 인증번호: ${code}\n이 인증번호는 5분 동안 유효합니다.`;

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 이메일 인증번호',
        html,
        text,
      });
    } catch (error) {
      logger.error('Failed to send verification code email', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const emailService = new EmailService();
