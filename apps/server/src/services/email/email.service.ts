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

type Lang = 'ko' | 'en';

const i18n: Record<Lang, Record<string, string>> = {
  ko: {
    slogan: '기록이 곧, 당신만의 트랙이 됩니다',
    resetTitle: '비밀번호 재설정 요청',
    resetGreeting: '안녕하세요,',
    resetBody: '비밀번호 재설정을 요청하셨습니다. 아래 링크를 클릭하여 새 비밀번호를 설정해주세요.',
    resetButton: '비밀번호 재설정하기',
    resetAlt: '또는 아래 링크를 브라우저에 직접 붙여넣으세요:',
    resetSecurity: '⚠️ 보안 안내',
    resetExpiry: '이 링크는 1시간 동안만 유효합니다.',
    resetIgnore: '본인이 요청하지 않았다면 이 이메일을 무시하세요.',
    resetKeepSafe: '비밀번호는 안전하게 보관하세요.',
    resetContact: '문의사항이 있으시면 고객지원으로 연락해주세요.',
    resetContactLink: '고객지원 문의하기',
    verifyTitle: '이메일 인증번호',
    verifyGreeting: '안녕하세요,',
    verifyBody: '아래 인증번호를 입력하여 이메일 인증을 완료해주세요.',
    verifyExpiry: '이 인증번호는 5분 동안 유효합니다.',
    verifyIgnore: '본인이 요청하지 않았다면 이 이메일을 무시하세요.',
    signupTitle: '회원가입 완료',
    signupBody: 'teum 회원가입이 완료되었습니다.',
    signupCta: '이제 일기를 작성하고, 감정을 기록하며, 나만의 음악을 만들어보세요.',
    signupButton: 'teum 시작하기',
    signupFooter: 'teum과 함께 매일의 기록을 음악으로 만들어보세요.',
    withdrawTitle: '회원 탈퇴 완료',
    withdrawBody: '회원 탈퇴가 정상적으로 처리되었습니다.',
    withdrawThanks: '그동안 teum을 이용해주셔서 감사합니다.',
    withdrawNotice: '탈퇴 후 1년간 동일 이메일로 재가입이 제한됩니다.',
    withdrawPrivacy: '개인정보는 관련 법령에 따라 일정 기간 보관 후 파기됩니다.',
    withdrawSeeYou: '다시 만날 날을 기다리겠습니다.',
    subStartTitle: '구독 시작',
    subStartBody: '구독이 시작되었습니다.',
    subStartFeatures: '이제 무제한으로 일기 작성, AI 가사 생성, 음악 생성을 이용하실 수 있습니다.',
    subStartButton: 'teum으로 이동',
    subStartContact: '구독 관련 문의사항은 고객지원을 통해 연락해주세요.',
    subCancelTitle: '구독 해지 완료',
    subCancelBody: '구독 해지가 정상적으로 처리되었습니다.',
    subCancelUntil: '까지 프리미엄 기능을 계속 이용하실 수 있습니다.',
    subCancelNotice: '이용 기간이 끝나면 자동결제가 중단되며, 무료 플랜으로 전환됩니다.',
    subCancelResub: '언제든지 다시 구독하실 수 있습니다.',
    subCancelThanks: '그동안 이용해주셔서 감사합니다.',
    profileTitle: '회원 정보 변경',
    profileBody: '회원 정보가 변경되었습니다.',
    profileChanged: '변경된 항목:',
    profileWarning: '본인이 변경하지 않았다면, 계정 보안을 위해 즉시 비밀번호를 변경해주세요.',
    inquirySubmitTitle: '문의 접수 완료',
    inquirySubmitBody: '문의가 정상적으로 접수되었습니다.',
    inquirySubmitSubject: '문의 제목:',
    inquirySubmitReply: '담당자가 확인 후 빠르게 답변드리겠습니다.',
    inquirySubmitNotice: '답변이 등록되면 이메일로 알려드립니다.',
    inquiryAnswerTitle: '문의 답변 등록',
    inquiryAnswerBody: '문의하신 내용에 답변이 등록되었습니다.',
    inquiryAnswerButton: '답변 확인하기',
    inquiryAnswerMore: '추가 문의사항이 있으시면 언제든지 문의해주세요.',
    refundTitle: '환불 처리 완료',
    refundBody: '환불이 처리되었으며, 프리미엄 이용 권한이 해지되었습니다.',
    refundNotice: '환불에 대해 궁금한 사항이 있으시면 고객지원으로 문의해주세요.',
    greeting: '안녕하세요,',
    greetingSuffix: '님!',
    greetingPeriod: '님.',
    fieldNickname: '닉네임',
    fieldName: '이름',
    fieldPhone: '전화번호',
    fieldDateOfBirth: '생년월일',
    fieldProfileImage: '프로필 사진',
    fieldCountry: '국가',
  },
  en: {
    slogan: 'Your records become your own track',
    resetTitle: 'Password Reset Request',
    resetGreeting: 'Hello,',
    resetBody: 'You have requested a password reset. Please click the link below to set a new password.',
    resetButton: 'Reset Password',
    resetAlt: 'Or paste this link into your browser:',
    resetSecurity: '⚠️ Security Notice',
    resetExpiry: 'This link is valid for 1 hour.',
    resetIgnore: 'If you did not request this, please ignore this email.',
    resetKeepSafe: 'Keep your password safe.',
    resetContact: 'If you have any questions, please contact our support.',
    resetContactLink: 'Contact Support',
    verifyTitle: 'Email Verification Code',
    verifyGreeting: 'Hello,',
    verifyBody: 'Please enter the verification code below to complete your email verification.',
    verifyExpiry: 'This code is valid for 5 minutes.',
    verifyIgnore: 'If you did not request this, please ignore this email.',
    signupTitle: 'Sign Up Complete',
    signupBody: 'Your teum registration is complete.',
    signupCta: 'Start writing your diary, tracking your emotions, and creating your own music.',
    signupButton: 'Get Started',
    signupFooter: 'Turn your daily records into music with teum.',
    withdrawTitle: 'Account Deleted',
    withdrawBody: 'Your account has been successfully deleted.',
    withdrawThanks: 'Thank you for using teum.',
    withdrawNotice: 'You cannot re-register with the same email for 1 year after deletion.',
    withdrawPrivacy: 'Personal data will be retained and then destroyed in accordance with applicable laws.',
    withdrawSeeYou: 'We hope to see you again.',
    subStartTitle: 'Subscription Started',
    subStartBody: 'Your subscription has started.',
    subStartFeatures: 'You now have unlimited access to diary writing, AI lyrics generation, and music creation.',
    subStartButton: 'Go to teum',
    subStartContact: 'For subscription inquiries, please contact our support.',
    subCancelTitle: 'Subscription Cancelled',
    subCancelBody: 'Your subscription has been successfully cancelled.',
    subCancelUntil: ' you can continue to use premium features.',
    subCancelNotice: 'Auto-renewal will stop at the end of the subscription period, and you will be switched to the free plan.',
    subCancelResub: 'You can resubscribe at any time.',
    subCancelThanks: 'Thank you for using our service.',
    profileTitle: 'Profile Updated',
    profileBody: 'Your profile information has been updated.',
    profileChanged: 'Changed fields:',
    profileWarning: 'If you did not make these changes, please change your password immediately for security.',
    inquirySubmitTitle: 'Inquiry Received',
    inquirySubmitBody: 'Your inquiry has been successfully submitted.',
    inquirySubmitSubject: 'Subject:',
    inquirySubmitReply: 'Our team will review and respond as soon as possible.',
    inquirySubmitNotice: 'You will be notified by email when a response is posted.',
    inquiryAnswerTitle: 'Inquiry Response',
    inquiryAnswerBody: 'A response has been posted to your inquiry.',
    inquiryAnswerButton: 'View Response',
    inquiryAnswerMore: 'If you have additional questions, feel free to reach out anytime.',
    refundTitle: 'Refund Processed',
    refundBody: 'Your refund has been processed and your premium access has been revoked.',
    refundNotice: 'If you have any questions about this refund, please contact our support team.',
    greeting: 'Hello,',
    greetingSuffix: '!',
    greetingPeriod: '.',
    fieldNickname: 'Nickname',
    fieldName: 'Name',
    fieldPhone: 'Phone',
    fieldDateOfBirth: 'Date of Birth',
    fieldProfileImage: 'Profile Image',
    fieldCountry: 'Country',
  },
};

function tt(lang: Lang, key: string): string {
  return i18n[lang]?.[key] || i18n['ko'][key] || key;
}

function buildNotificationHtml(lang: Lang, title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #4A2C1A; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dark.logo.png" alt="teum" style="height: 48px; width: auto; display: inline-block; border: 0;">
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${tt(lang, 'slogan')}</p>
        </div>
        
        <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #4A2C1A; margin-top: 0;">${title}</h2>
          ${body}
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} teum. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;
}

function resolveLang(lang?: string): Lang {
  return lang === 'en' ? 'en' : 'ko';
}

export class EmailService {
  private provider: EmailProvider;

  constructor(provider: EmailProvider = getDefaultProvider()) {
    this.provider = provider;
  }

  async sendPasswordResetEmail(email: string, token: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${tt(l, 'resetTitle')}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #4A2C1A; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dark.logo.png" alt="teum" style="height: 48px; width: auto; display: inline-block; border: 0;">
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${tt(l, 'slogan')}</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #4A2C1A; margin-top: 0;">${tt(l, 'resetTitle')}</h2>
            
            <p>${tt(l, 'resetGreeting')}</p>
            
            <p>${tt(l, 'resetBody')}</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background-color: #4A2C1A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                ${tt(l, 'resetButton')}
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              ${tt(l, 'resetAlt')}<br>
              <a href="${resetLink}" style="color: #4A2C1A; word-break: break-all;">${resetLink}</a>
            </p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>${tt(l, 'resetSecurity')}</strong><br>
                • ${tt(l, 'resetExpiry')}<br>
                • ${tt(l, 'resetIgnore')}<br>
                • ${tt(l, 'resetKeepSafe')}
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
              ${tt(l, 'resetContact')}<br>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my" style="color: #4A2C1A;">${tt(l, 'resetContactLink')}</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} teum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const subject = l === 'en' ? '[teum] Password Reset Request' : '[teum] 비밀번호 재설정 요청';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send password reset email', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async sendVerificationCodeEmail(email: string, code: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${tt(l, 'verifyTitle')}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #4A2C1A; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dark.logo.png" alt="teum" style="height: 48px; width: auto; display: inline-block; border: 0;">
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${tt(l, 'slogan')}</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 40px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #4A2C1A; margin-top: 0;">${tt(l, 'verifyTitle')}</h2>
            
            <p>${tt(l, 'verifyGreeting')}</p>
            <p>${tt(l, 'verifyBody')}</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #f5ede4; border: 2px solid #4A2C1A; padding: 16px 40px; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #4A2C1A;">
                ${code}
              </div>
            </div>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                ${tt(l, 'verifyExpiry')}<br>
                ${tt(l, 'verifyIgnore')}
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} teum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const subject = l === 'en' ? '[teum] Email Verification Code' : '[teum] 이메일 인증번호';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send verification code email', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async sendSignupNotification(email: string, nickname: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingSuffix')}</p>
      <p>${tt(l, 'signupBody')}</p>
      <p>${tt(l, 'signupCta')}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
           style="display: inline-block; background-color: #4A2C1A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          ${tt(l, 'signupButton')}
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">${tt(l, 'signupFooter')}</p>
    `;
    const html = buildNotificationHtml(l, tt(l, 'signupTitle'), body);
    const subject = l === 'en' ? '[teum] Welcome! Your registration is complete' : '[teum] 회원가입이 완료되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send signup notification email', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendWithdrawalNotification(email: string, nickname: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingPeriod')}</p>
      <p>${tt(l, 'withdrawBody')}</p>
      <p>${tt(l, 'withdrawThanks')}</p>
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          ${tt(l, 'withdrawNotice')}<br>
          ${tt(l, 'withdrawPrivacy')}
        </p>
      </div>
      <p style="color: #666; font-size: 14px;">${tt(l, 'withdrawSeeYou')}</p>
    `;
    const html = buildNotificationHtml(l, tt(l, 'withdrawTitle'), body);
    const subject = l === 'en' ? '[teum] Your account has been deleted' : '[teum] 회원 탈퇴가 완료되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send withdrawal notification email', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendSubscriptionStartNotification(email: string, nickname: string, planName: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const safePlanName = escapeHtml(planName);
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingSuffix')}</p>
      <p><strong>${safePlanName}</strong> ${tt(l, 'subStartBody')}</p>
      <p>${tt(l, 'subStartFeatures')}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
           style="display: inline-block; background-color: #4A2C1A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          ${tt(l, 'subStartButton')}
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">${tt(l, 'subStartContact')}</p>
    `;
    const html = buildNotificationHtml(l, tt(l, 'subStartTitle'), body);
    const subject = l === 'en' ? '[teum] Your subscription has started' : '[teum] 구독이 시작되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send subscription start notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendSubscriptionCancelNotification(email: string, nickname: string, endDate: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const safeEndDate = escapeHtml(endDate);
    const untilText = l === 'en'
      ? `Until <strong>${safeEndDate}</strong>,${tt(l, 'subCancelUntil')}`
      : `<strong>${safeEndDate}</strong>${tt(l, 'subCancelUntil')}`;
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingPeriod')}</p>
      <p>${tt(l, 'subCancelBody')}</p>
      <p>${untilText}</p>
      <div style="background-color: #e8f4fd; border-left: 4px solid #2196F3; padding: 15px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; color: #1565C0; font-size: 14px;">
          ${tt(l, 'subCancelNotice')}<br>
          ${tt(l, 'subCancelResub')}
        </p>
      </div>
      <p style="color: #666; font-size: 14px;">${tt(l, 'subCancelThanks')}</p>
    `;
    const html = buildNotificationHtml(l, tt(l, 'subCancelTitle'), body);
    const subject = l === 'en' ? '[teum] Your subscription has been cancelled' : '[teum] 구독이 해지되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send subscription cancel notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendProfileUpdateNotification(email: string, nickname: string, changedFields: string[], lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const fieldNames: Record<string, string> = {
      nickname: tt(l, 'fieldNickname'),
      name: tt(l, 'fieldName'),
      phone: tt(l, 'fieldPhone'),
      dateOfBirth: tt(l, 'fieldDateOfBirth'),
      profileImageUrl: tt(l, 'fieldProfileImage'),
    };
    const changedList = changedFields.map(f => fieldNames[f] || f).join(', ');
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingPeriod')}</p>
      <p>${tt(l, 'profileBody')}</p>
      <div style="background-color: #f5ede4; border: 1px solid #d4c5b0; padding: 15px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #4A2C1A; font-size: 14px;">
          <strong>${tt(l, 'profileChanged')}</strong> ${changedList}
        </p>
      </div>
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0; border-radius: 4px;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          ${tt(l, 'profileWarning')}
        </p>
      </div>
    `;
    const html = buildNotificationHtml(l, tt(l, 'profileTitle'), body);
    const subject = l === 'en' ? '[teum] Your profile has been updated' : '[teum] 회원 정보가 변경되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send profile update notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendInquirySubmittedNotification(email: string, nickname: string, subject: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const safeSubject = escapeHtml(subject);
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingPeriod')}</p>
      <p>${tt(l, 'inquirySubmitBody')}</p>
      <div style="background-color: #f5ede4; border: 1px solid #d4c5b0; padding: 15px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #4A2C1A; font-size: 14px;">
          <strong>${tt(l, 'inquirySubmitSubject')}</strong> ${safeSubject}
        </p>
      </div>
      <p>${tt(l, 'inquirySubmitReply')}</p>
      <p style="color: #666; font-size: 14px;">${tt(l, 'inquirySubmitNotice')}</p>
    `;
    const html = buildNotificationHtml(l, tt(l, 'inquirySubmitTitle'), body);
    const emailSubject = l === 'en' ? '[teum] Your inquiry has been received' : '[teum] 문의가 접수되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject: emailSubject, html });
    } catch (error) {
      logger.error('Failed to send inquiry submitted notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendInquiryAnsweredNotification(email: string, nickname: string, subject: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const safeSubject = escapeHtml(subject);
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingPeriod')}</p>
      <p>${tt(l, 'inquiryAnswerBody')}</p>
      <div style="background-color: #f5ede4; border: 1px solid #d4c5b0; padding: 15px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #4A2C1A; font-size: 14px;">
          <strong>${tt(l, 'inquirySubmitSubject')}</strong> ${safeSubject}
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/my/support" 
           style="display: inline-block; background-color: #4A2C1A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          ${tt(l, 'inquiryAnswerButton')}
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">${tt(l, 'inquiryAnswerMore')}</p>
    `;
    const html = buildNotificationHtml(l, tt(l, 'inquiryAnswerTitle'), body);
    const emailSubject = l === 'en' ? '[teum] A response has been posted to your inquiry' : '[teum] 문의하신 내용에 답변이 등록되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject: emailSubject, html });
    } catch (error) {
      logger.error('Failed to send inquiry answered notification', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  async sendRefundNotificationToUser(email: string, nickname: string, amount?: string, currency?: string, lang?: string): Promise<void> {
    const l = resolveLang(lang);
    const safeNickname = escapeHtml(nickname);
    const amountDisplay = amount && currency
      ? (currency === 'USD' ? `$${amount}` : `${Number(amount).toLocaleString()}원`)
      : '';
    const body = `
      <p>${tt(l, 'greeting')} <strong>${safeNickname}</strong>${tt(l, 'greetingPeriod')}</p>
      <p>${tt(l, 'refundBody')}</p>
      ${amountDisplay ? `
      <div style="background-color: #f5ede4; border: 1px solid #d4c5b0; padding: 15px; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #4A2C1A; font-size: 14px;">
          <strong>${l === 'en' ? 'Refund amount:' : '환불 금액:'}</strong> ${amountDisplay}
        </p>
      </div>` : ''}
      <p style="color: #666; font-size: 14px;">${tt(l, 'refundNotice')}</p>
    `;
    const html = buildNotificationHtml(l, tt(l, 'refundTitle'), body);
    const subject = l === 'en' ? '[teum] Your refund has been processed' : '[teum] 환불이 처리되었습니다';

    try {
      await this.provider.sendEmail({ to: email, subject, html });
    } catch (error) {
      logger.error('Failed to send refund notification to user', { email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  async sendRefundNotificationToAdmin(data: {
    userId: string;
    paymentId?: string;
    amount?: string;
    currency?: string;
    eventType: string;
    timestamp: string;
  }): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      logger.warn('ADMIN_EMAIL not configured, skipping admin refund notification');
      return;
    }

    const html = buildNotificationHtml('en', 'Refund Processed', `
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">User ID</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(data.userId)}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Payment ID</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(data.paymentId || 'N/A')}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Amount</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.amount ? `${data.amount} ${data.currency || ''}` : 'N/A'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Event Type</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(data.eventType)}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Timestamp</td><td style="padding: 8px;">${escapeHtml(data.timestamp)}</td></tr>
      </table>
    `);

    try {
      await this.provider.sendEmail({ to: adminEmail, subject: '[teum Admin] Refund processed', html });
    } catch (error) {
      logger.error('Failed to send refund notification to admin', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const emailService = new EmailService();
