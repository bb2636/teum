import { EmailProvider } from './email.provider';
import { resendProvider } from './resend.provider';
import { logger } from '../../config/logger';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) {
    return resendProvider;
  }
  const { nodemailerProvider } = require('./nodemailer.provider');
  return nodemailerProvider;
}

function buildNotificationHtml(title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #8B4513; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">teum</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">기록이 곧, 당신만의 트랙이 됩니다</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #8B4513; margin-top: 0;">${title}</h2>
          ${body}
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} teum. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;
}

export class EmailService {
  private provider: EmailProvider;

  constructor(provider: EmailProvider = getDefaultProvider()) {
    this.provider = provider;
  }

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

  async sendSignupNotification(email: string, nickname: string): Promise<void> {
    const safeNickname = escapeHtml(nickname);
    const body = `
      <p>안녕하세요, <strong>${safeNickname}</strong>님!</p>
      <p>teum 회원가입이 완료되었습니다.</p>
      <p>이제 일기를 작성하고, 감정을 기록하며, 나만의 음악을 만들어보세요.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
           style="display: inline-block; background-color: #8B4513; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          teum 시작하기
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">teum과 함께 매일의 기록을 음악으로 만들어보세요.</p>
    `;
    const html = buildNotificationHtml('회원가입 완료', body);

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 회원가입이 완료되었습니다',
        html,
        text: `[teum] 회원가입 완료\n\n안녕하세요, ${nickname}님!\nteum 회원가입이 완료되었습니다.`,
      });
    } catch (error) {
      logger.error('Failed to send signup notification email', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendWithdrawalNotification(email: string, nickname: string): Promise<void> {
    const safeNickname = escapeHtml(nickname);
    const body = `
      <p>안녕하세요, <strong>${safeNickname}</strong>님.</p>
      <p>회원 탈퇴가 정상적으로 처리되었습니다.</p>
      <p>그동안 teum을 이용해주셔서 감사합니다.</p>
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          탈퇴 후 1년간 동일 이메일로 재가입이 제한됩니다.<br>
          개인정보는 관련 법령에 따라 일정 기간 보관 후 파기됩니다.
        </p>
      </div>
      <p style="color: #666; font-size: 14px;">다시 만날 날을 기다리겠습니다.</p>
    `;
    const html = buildNotificationHtml('회원 탈퇴 완료', body);

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 회원 탈퇴가 완료되었습니다',
        html,
        text: `[teum] 회원 탈퇴 완료\n\n안녕하세요, ${nickname}님.\n회원 탈퇴가 정상적으로 처리되었습니다.\n그동안 teum을 이용해주셔서 감사합니다.`,
      });
    } catch (error) {
      logger.error('Failed to send withdrawal notification email', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendSubscriptionStartNotification(email: string, nickname: string, planName: string): Promise<void> {
    const safeNickname = escapeHtml(nickname);
    const safePlanName = escapeHtml(planName);
    const body = `
      <p>안녕하세요, <strong>${safeNickname}</strong>님!</p>
      <p><strong>${safePlanName}</strong> 구독이 시작되었습니다.</p>
      <p>이제 무제한으로 일기 작성, AI 가사 생성, 음악 생성을 이용하실 수 있습니다.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
           style="display: inline-block; background-color: #8B4513; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          teum으로 이동
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">구독 관련 문의사항은 고객지원을 통해 연락해주세요.</p>
    `;
    const html = buildNotificationHtml('구독 시작', body);

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 구독이 시작되었습니다',
        html,
        text: `[teum] 구독 시작\n\n안녕하세요, ${nickname}님!\n${planName} 구독이 시작되었습니다.\n무제한으로 일기, 가사, 음악 생성을 이용하실 수 있습니다.`,
      });
    } catch (error) {
      logger.error('Failed to send subscription start notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendSubscriptionCancelNotification(email: string, nickname: string, endDate: string): Promise<void> {
    const safeNickname = escapeHtml(nickname);
    const safeEndDate = escapeHtml(endDate);
    const body = `
      <p>안녕하세요, <strong>${safeNickname}</strong>님.</p>
      <p>구독 해지가 정상적으로 처리되었습니다.</p>
      <p><strong>${safeEndDate}</strong>까지 프리미엄 기능을 계속 이용하실 수 있습니다.</p>
      <div style="background-color: #e8f4fd; border-left: 4px solid #2196F3; padding: 15px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; color: #1565C0; font-size: 14px;">
          이용 기간이 끝나면 자동결제가 중단되며, 무료 플랜으로 전환됩니다.<br>
          언제든지 다시 구독하실 수 있습니다.
        </p>
      </div>
      <p style="color: #666; font-size: 14px;">그동안 이용해주셔서 감사합니다.</p>
    `;
    const html = buildNotificationHtml('구독 해지 완료', body);

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 구독이 해지되었습니다',
        html,
        text: `[teum] 구독 해지 완료\n\n안녕하세요, ${nickname}님.\n구독 해지가 정상적으로 처리되었습니다.\n${endDate}까지 프리미엄 기능을 계속 이용하실 수 있습니다.`,
      });
    } catch (error) {
      logger.error('Failed to send subscription cancel notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendProfileUpdateNotification(email: string, nickname: string, changedFields: string[]): Promise<void> {
    const safeNickname = escapeHtml(nickname);
    const fieldNames: Record<string, string> = {
      nickname: '닉네임',
      name: '이름',
      phone: '전화번호',
      dateOfBirth: '생년월일',
      profileImageUrl: '프로필 사진',
      country: '국가',
    };
    const changedList = changedFields.map(f => fieldNames[f] || f).join(', ');
    const body = `
      <p>안녕하세요, <strong>${safeNickname}</strong>님.</p>
      <p>회원 정보가 변경되었습니다.</p>
      <div style="background-color: #f5ede4; border: 1px solid #d4c5b0; padding: 15px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #4A2C1A; font-size: 14px;">
          <strong>변경된 항목:</strong> ${changedList}
        </p>
      </div>
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          본인이 변경하지 않았다면, 계정 보안을 위해 즉시 비밀번호를 변경해주세요.
        </p>
      </div>
    `;
    const html = buildNotificationHtml('회원 정보 변경', body);

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 회원 정보가 변경되었습니다',
        html,
        text: `[teum] 회원 정보 변경\n\n안녕하세요, ${nickname}님.\n회원 정보가 변경되었습니다.\n변경된 항목: ${changedList}\n\n본인이 변경하지 않았다면 즉시 비밀번호를 변경해주세요.`,
      });
    } catch (error) {
      logger.error('Failed to send profile update notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendInquirySubmittedNotification(email: string, nickname: string, subject: string): Promise<void> {
    const safeNickname = escapeHtml(nickname);
    const safeSubject = escapeHtml(subject);
    const body = `
      <p>안녕하세요, <strong>${safeNickname}</strong>님.</p>
      <p>문의가 정상적으로 접수되었습니다.</p>
      <div style="background-color: #f5ede4; border: 1px solid #d4c5b0; padding: 15px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #4A2C1A; font-size: 14px;">
          <strong>문의 제목:</strong> ${safeSubject}
        </p>
      </div>
      <p>담당자가 확인 후 빠르게 답변드리겠습니다.</p>
      <p style="color: #666; font-size: 14px;">답변이 등록되면 이메일로 알려드립니다.</p>
    `;
    const html = buildNotificationHtml('문의 접수 완료', body);

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 문의가 접수되었습니다',
        html,
        text: `[teum] 문의 접수 완료\n\n안녕하세요, ${nickname}님.\n문의가 정상적으로 접수되었습니다.\n문의 제목: ${subject}\n\n담당자가 확인 후 빠르게 답변드리겠습니다.`,
      });
    } catch (error) {
      logger.error('Failed to send inquiry submitted notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendInquiryAnsweredNotification(email: string, nickname: string, subject: string): Promise<void> {
    const safeNickname = escapeHtml(nickname);
    const safeSubject = escapeHtml(subject);
    const body = `
      <p>안녕하세요, <strong>${safeNickname}</strong>님.</p>
      <p>문의하신 내용에 답변이 등록되었습니다.</p>
      <div style="background-color: #f5ede4; border: 1px solid #d4c5b0; padding: 15px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #4A2C1A; font-size: 14px;">
          <strong>문의 제목:</strong> ${safeSubject}
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my/support" 
           style="display: inline-block; background-color: #8B4513; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          답변 확인하기
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">추가 문의사항이 있으시면 언제든지 문의해주세요.</p>
    `;
    const html = buildNotificationHtml('문의 답변 등록', body);

    try {
      await this.provider.sendEmail({
        to: email,
        subject: '[teum] 문의하신 내용에 답변이 등록되었습니다',
        html,
        text: `[teum] 문의 답변 등록\n\n안녕하세요, ${nickname}님.\n문의하신 내용에 답변이 등록되었습니다.\n문의 제목: ${subject}\n\nteum 앱에서 답변을 확인해주세요.`,
      });
    } catch (error) {
      logger.error('Failed to send inquiry answered notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const emailService = new EmailService();
