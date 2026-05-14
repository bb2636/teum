import { userRepository } from '../repositories/user.repository';
import { phoneVerificationRepository } from '../repositories/phone-verification.repository';
import { emailVerificationRepository } from '../repositories/email-verification.repository';
import { termsConsentRepository } from '../repositories/terms-consent.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, JWTPayload } from '../utils/jwt';
import { logger } from '../config/logger';
import { smsService } from './sms/sms.service';
import { emailService } from './email/email.service';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  SignupInput,
  LoginInput,
  PhoneVerificationRequestInput,
  PhoneVerificationConfirmInput,
  EmailVerificationRequestInput,
  EmailVerificationConfirmInput,
  SocialOnboardingInput,
} from '../validations/auth';

// ─────────────────────────────────────────────────────────────────
// Apple 심사용 데모 계정 SMS/이메일 인증 우회.
//
// ⚠️ 보안: 기본값은 "비활성". 활성화하려면 운영 환경변수에
//   ENABLE_REVIEW_BYPASS=true 와 함께 (선택) TEST_BYPASS_EMAILS / TEST_BYPASS_PHONES
//   를 설정해야 한다. 둘 다 미설정이면 fallback 데모값으로 동작하지만,
//   ENABLE_REVIEW_BYPASS 가 없으면 어떠한 우회도 일어나지 않는다.
//
// App Store Connect "심사 노트" 에 아래 값을 명시한다.
//   - 데모 이메일: test1@test.com
//   - 데모 전화번호: +10000000000
//   - 인증코드(SMS/이메일 모두): 123456
// ─────────────────────────────────────────────────────────────────
const TEST_BYPASS_CODE = '123456';
const REVIEW_BYPASS_ENABLED = process.env.ENABLE_REVIEW_BYPASS === 'true';
const TEST_BYPASS_EMAILS = new Set(
  (process.env.TEST_BYPASS_EMAILS || 'test1@test.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);
// 우회 대상 전화번호. 사용자가 입력할 수 있는 모든 표기 형태를 포함:
//   - 한국 로컬 표기: 01000000000 / 1000000000 (앞 0 제외)
//   - 미국 표기: +10000000000 / 10000000000
//   - 국가코드 결합형: +821000000000, +8210000000000 등
// 매칭 시 normalize 함수가 양쪽 모두 비교한다.
const TEST_BYPASS_PHONES = new Set(
  (
    process.env.TEST_BYPASS_PHONES ||
    '01000000000,1000000000,+10000000000,10000000000,+821000000000,+8210000000000'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

if (REVIEW_BYPASS_ENABLED) {
  logger.warn(
    {
      emails: Array.from(TEST_BYPASS_EMAILS),
      phones: Array.from(TEST_BYPASS_PHONES),
    },
    '⚠️ REVIEW BYPASS ENABLED — SMS/email verification bypassed for listed test accounts',
  );
}

function isBypassEmail(email: string): boolean {
  if (!REVIEW_BYPASS_ENABLED) return false;
  return TEST_BYPASS_EMAILS.has(email.trim().toLowerCase());
}
function isBypassPhone(phone: string, countryCode?: string): boolean {
  if (!REVIEW_BYPASS_ENABLED) return false;
  const normalized = phone.replace(/[^0-9+]/g, '');
  const digitsOnly = normalized.replace(/\+/g, '');
  const stripLeadingZero = digitsOnly.replace(/^0+/, '');
  const candidates = new Set<string>([phone, normalized, digitsOnly, stripLeadingZero]);
  if (countryCode) {
    const cc = countryCode.replace(/[^0-9+]/g, '');
    candidates.add(cc + stripLeadingZero);
    candidates.add(cc + digitsOnly);
  }
  for (const c of candidates) {
    if (TEST_BYPASS_PHONES.has(c)) return true;
  }
  return false;
}

export class AuthService {
  private async generateTokensForUser(user: { id: string; email: string; role: string }) {
    const newTokenVersion = await userRepository.incrementTokenVersion(user.id);
    const payload: JWTPayload = { userId: user.id, email: user.email, role: user.role, tokenVersion: newTokenVersion };
    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }

  async signup(input: SignupInput) {
    // Check if user already exists (including withdrawn accounts)
    const existingUser = await userRepository.findByEmailIncludingDeleted(input.email);
    if (existingUser) {
      if (existingUser.deletedAt) {
        const deletedAt = new Date(existingUser.deletedAt);
        const oneYearLater = new Date(deletedAt);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        if (new Date() < oneYearLater) {
          throw new Error('탈퇴한 계정의 이메일로는 1년간 재가입이 불가합니다.');
        }
      } else {
        throw new Error('User with this email already exists');
      }
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await userRepository.createUser({
      email: input.email,
      passwordHash,
      role: 'user',
    });

    await userRepository.createProfile({
      userId: user.id,
      nickname: input.nickname,
      name: input.name,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      profileImageUrl: input.profileImageUrl || undefined,
      language: input.language || 'ko',
    });

    await userRepository.createDefaultFolder(user.id);

    await userRepository.createAuthAccount({
      userId: user.id,
      provider: 'email',
      providerAccountId: user.id,
    });

    // Create terms consents
    if (input.termsConsents.length > 0) {
      await termsConsentRepository.createMany(
        input.termsConsents.map((consent) => ({
          userId: user.id,
          termsType: consent.termsType,
          consented: consent.consented,
        }))
      );
    }

    const tokens = await this.generateTokensForUser(user);

    emailService.sendSignupNotification(user.email, input.nickname, input.language || 'ko').catch((err: unknown) => logger.warn('Signup notification email failed', { error: err instanceof Error ? err.message : String(err) }));

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    try {
      logger.debug('AuthService.login - Finding user', { email: input.email });
      
      // Find user
      const user = await userRepository.findByEmail(input.email);
      logger.debug('User found', { 
        found: !!user, 
        userId: user?.id, 
        email: user?.email, 
        hasPassword: !!user?.passwordHash, 
        isActive: user?.isActive 
      });
      
      if (!user || !user.passwordHash) {
        logger.warn('Login attempt failed: user not found or no password hash', { email: input.email });
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (user.isActive === false) {
        logger.warn('Login attempt failed: account suspended', { userId: user.id, email: user.email });
        throw new Error('계정이 정지되었습니다. 관리자에게 문의하세요.');
      }

      // Verify password
      logger.debug('Comparing password');
      const isValid = await comparePassword(input.password, user.passwordHash);
      logger.debug('Password comparison result', { isValid });
      
      if (!isValid) {
        logger.warn('Login attempt failed: password mismatch', { email: input.email });
        throw new Error('Invalid email or password');
      }

      const tokens = await this.generateTokensForUser(user);
      logger.debug('Tokens generated successfully', { userId: user.id });

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        ...tokens,
      };
    } catch (error) {
      // Re-throw authentication errors
      if (error instanceof Error && error.message.includes('Invalid email or password')) {
        throw error;
      }
      // Re-throw token generation errors
      if (error instanceof Error && error.message.includes('Failed to generate')) {
        throw error;
      }
      // Log unexpected errors
      logger.error('Login error in AuthService', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Re-throw the original error with more context
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Login failed. Please try again.');
    }
  }

  private buildFullPhone(phone: string, countryCode?: string): string {
    if (phone.startsWith('+')) return phone;
    if (countryCode) {
      const digits = phone.replace(/^0+/, '');
      return countryCode + digits;
    }
    return phone;
  }

  async requestPhoneVerification(input: PhoneVerificationRequestInput, requesterEmail?: string) {
    // Apple 심사용 데모 계정: 로그인된 사용자가 bypass 이메일이거나 전화번호가 bypass 목록이면 우회.
    // (심사관이 본인 핸드폰 번호로 결제 본인인증을 진행할 수 있도록 이메일 기반 우회를 허용한다.)
    const bypass =
      (requesterEmail && isBypassEmail(requesterEmail)) ||
      isBypassPhone(input.phone, input.countryCode);
    if (bypass) {
      logger.info('Phone verification BYPASSED (Apple review demo account)', {
        phone: input.phone,
        requesterEmail,
      });
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      await phoneVerificationRepository.markAsExpired(input.phone);
      await phoneVerificationRepository.create({
        phone: input.phone,
        code: TEST_BYPASS_CODE,
        expiresAt,
      });
      return {
        message: 'Verification code sent (test mode)',
        expiresIn: 600,
      };
    }

    const lockStatus = await phoneVerificationRepository.isPhoneLocked(input.phone);
    if (lockStatus.locked) {
      const lockedUntil = lockStatus.lockedUntil!;
      const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`인증번호 입력 횟수를 초과했습니다. ${remainingMinutes}분 후에 다시 시도해주세요.`);
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await phoneVerificationRepository.markAsExpired(input.phone);

    // Twilio Verify owns the OTP — we keep a placeholder row only for lock/attempt tracking.
    await phoneVerificationRepository.create({
      phone: input.phone,
      code: 'verify',
      expiresAt,
    });

    const fullPhone = this.buildFullPhone(input.phone, input.countryCode);

    logger.info('Phone verification requested via Twilio Verify', {
      phone: input.phone,
      fullPhone: fullPhone.slice(0, 4) + '****',
    });

    try {
      await smsService.sendVerification(fullPhone);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const twilioCode = (error as { code?: number | string } | undefined)?.code;
      const twilioStatus = (error as { status?: number } | undefined)?.status;
      logger.error('Failed to send Twilio Verify code', {
        phone: input.phone,
        fullPhone: fullPhone.slice(0, 4) + '****',
        error: message,
        twilioCode,
        twilioStatus,
      });

      let userMessage = '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.';
      if (twilioCode === 60200 || /Invalid parameter|not a valid phone/i.test(message)) {
        userMessage = '전화번호 형식이 올바르지 않습니다. 국가번호를 포함해 다시 입력해주세요.';
      } else if (twilioCode === 21408 || twilioCode === 60410 || /not been enabled|Geo-Permission/i.test(message)) {
        userMessage = '해당 국가는 현재 SMS 인증이 지원되지 않습니다. 관리자에게 문의해주세요.';
      } else if (twilioCode === 60605) {
        userMessage = '인도 SMS는 일시적으로 제한되어 있습니다. 잠시 후 다시 시도해주세요.';
      } else if (twilioCode === 20429 || /Too Many Requests|rate limit/i.test(message)) {
        userMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
      } else if (/TWILIO_VERIFY_SERVICE_SID not configured/i.test(message)) {
        userMessage = '인증 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.';
      }

      const businessError = new Error(userMessage) as Error & { statusCode?: number; code?: string };
      businessError.statusCode = 400;
      businessError.code = 'PHONE_VERIFICATION_SEND_FAILED';
      throw businessError;
    }

    return {
      message: 'Verification code sent',
      expiresIn: 600,
    };
  }

  async confirmPhoneVerification(input: PhoneVerificationConfirmInput, userId?: string, requesterEmail?: string) {
    // Apple 심사용 데모 계정: 로그인 이메일이 bypass 또는 phone 이 bypass 면 고정코드 123456 검증.
    const bypass =
      (requesterEmail && isBypassEmail(requesterEmail)) ||
      isBypassPhone(input.phone, input.countryCode);
    if (bypass) {
      const pending = await phoneVerificationRepository.findPendingByPhone(input.phone);
      if (!pending) {
        throw new Error('인증번호 요청 기록이 없거나 만료되었습니다. 다시 요청해주세요.');
      }
      if (input.code !== TEST_BYPASS_CODE) {
        throw new Error('인증번호가 올바르지 않습니다.');
      }
      await phoneVerificationRepository.markAsVerified(pending.id, userId);
      logger.info('Phone verification BYPASSED CONFIRM (Apple review demo account)', {
        phone: input.phone,
        requesterEmail,
      });
      return { message: 'Phone number verified', verified: true };
    }

    const lockStatus = await phoneVerificationRepository.isPhoneLocked(input.phone);
    if (lockStatus.locked) {
      const lockedUntil = lockStatus.lockedUntil!;
      const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`인증번호 입력 횟수를 초과했습니다. ${remainingMinutes}분 후에 다시 시도해주세요.`);
    }

    const pending = await phoneVerificationRepository.findPendingByPhone(input.phone);
    if (!pending) {
      throw new Error('인증번호 요청 기록이 없거나 만료되었습니다. 다시 요청해주세요.');
    }

    const fullPhone = this.buildFullPhone(input.phone, input.countryCode);

    let approved = false;
    try {
      approved = await smsService.checkVerification(fullPhone, input.code);
    } catch (error) {
      logger.error('Twilio Verify check failed', {
        phone: input.phone,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('인증번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }

    if (!approved) {
      const updated = await phoneVerificationRepository.incrementFailedAttempts(pending.id);
      if (updated && updated.failedAttempts >= 5) {
        await phoneVerificationRepository.lockVerification(pending.id);
        throw new Error('인증번호 입력 횟수를 초과했습니다. 1시간 후에 다시 시도해주세요.');
      }
      const remaining = 5 - (updated?.failedAttempts || 0);
      throw new Error(`인증번호가 올바르지 않습니다. (남은 시도 횟수: ${remaining}회)`);
    }

    await phoneVerificationRepository.markAsVerified(pending.id, userId);

    return {
      message: 'Phone number verified',
      verified: true,
    };
  }

  async checkEmailExists(email: string) {
    const existingUser = await userRepository.findByEmailIncludingDeleted(email);
    if (existingUser && existingUser.deletedAt) {
      const deletedAt = new Date(existingUser.deletedAt);
      const oneYearLater = new Date(deletedAt);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      if (new Date() >= oneYearLater) {
        return { exists: false, isWithdrawn: false };
      }
      return { exists: true, isWithdrawn: true };
    }
    return {
      exists: !!existingUser,
      isWithdrawn: false,
    };
  }

  async requestEmailVerification(input: EmailVerificationRequestInput) {
    const existingUser = await userRepository.findByEmailIncludingDeleted(input.email);
    if (existingUser) {
      if (existingUser.deletedAt) {
        const deletedAt = new Date(existingUser.deletedAt);
        const oneYearLater = new Date(deletedAt);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        if (new Date() < oneYearLater) {
          throw new Error('탈퇴한 계정의 이메일로는 1년간 재가입이 불가합니다.');
        }
      } else {
        throw new Error('이미 존재하는 이메일입니다. 다른 이메일을 입력해주세요.');
      }
    }

    // Apple 심사용 데모 이메일: 고정코드 123456 사용. Resend 호출 스킵.
    const isBypass = isBypassEmail(input.email);
    const code = isBypass
      ? TEST_BYPASS_CODE
      : Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration (5 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Mark previous verifications as expired
    await emailVerificationRepository.markAsExpired(input.email);

    // Create new verification
    const verification = await emailVerificationRepository.create({
      email: input.email,
      code,
      expiresAt,
    });

    logger.info('Email verification code generated', {
      email: input.email,
      expiresAt: expiresAt.toISOString(),
      bypass: isBypass,
    });

    if (!isBypass) {
      try {
        await emailService.sendVerificationCodeEmail(input.email, code);
      } catch (error) {
        logger.error('Failed to send email verification code', {
          email: input.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      message: 'Verification code sent',
      expiresIn: 300,
    };
  }

  async requestEmailVerificationForPasswordReset(input: EmailVerificationRequestInput) {
    // Check if email exists (for password reset, email must exist)
    const existingUser = await userRepository.findByEmail(input.email);
    if (!existingUser) {
      throw new Error('존재하지 않는 이메일입니다.');
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration (5 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Mark previous verifications as expired
    await emailVerificationRepository.markAsExpired(input.email);

    // Create new verification
    const verification = await emailVerificationRepository.create({
      userId: existingUser.id,
      email: input.email,
      code,
      expiresAt,
    });

    logger.info('Email verification code generated for password reset', {
      email: input.email,
      expiresAt: expiresAt.toISOString(),
    });

    try {
      await emailService.sendVerificationCodeEmail(input.email, code);
    } catch (error) {
      logger.error('Failed to send password reset email verification code', {
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      message: 'Verification code sent',
      expiresIn: 300,
    };
  }

  async confirmEmailVerification(input: EmailVerificationConfirmInput) {
    // Find valid verification
    const verification = await emailVerificationRepository.findValidCode(
      input.email,
      input.code
    );

    if (!verification) {
      throw new Error('Invalid or expired verification code');
    }

    // Mark as verified
    await emailVerificationRepository.markAsVerified(verification.id);

    return {
      message: 'Email verified',
      verified: true,
    };
  }
  async googleLogin(idToken: string) {
    logger.info('Google login attempt');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google OAuth is not configured');
    }

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new Error('Invalid Google token');
    }

    const googleId = payload.sub;
    const email = payload.email || '';
    const name = payload.name || '';
    const picture = payload.picture || '';

    const existingAuth = await userRepository.findAuthAccount('google', googleId);
    if (existingAuth) {
      const user = await userRepository.findById(existingAuth.userId);
      if (!user) {
        throw new Error('User not found');
      }
      if (user.isActive === false) {
        throw new Error('계정이 정지되었습니다. 관리자에게 문의하세요.');
      }

      const tokens = await this.generateTokensForUser(user);

      return {
        isNewUser: false,
        user: { id: user.id, email: user.email, role: user.role },
        ...tokens,
      };
    }

    const existingUser = await userRepository.findByEmailIncludingDeleted(email);
    if (existingUser && !existingUser.deletedAt) {
      await userRepository.createAuthAccount({
        userId: existingUser.id,
        provider: 'google',
        providerAccountId: googleId,
      });
      const tokens = await this.generateTokensForUser(existingUser);
      return {
        isNewUser: false,
        user: { id: existingUser.id, email: existingUser.email, role: existingUser.role },
        ...tokens,
      };
    }

    const onboardingToken = jwt.sign(
      { provider: 'google', providerAccountId: googleId, email, name, picture },
      process.env.JWT_SECRET!,
      { expiresIn: '30m' }
    );

    return {
      isNewUser: true,
      onboardingToken,
      socialProfile: {
        provider: 'google' as const,
        providerAccountId: googleId,
        email,
        name,
        picture,
      },
    };
  }

  async appleLogin(idToken: string, userData?: { email?: string; name?: { firstName?: string; lastName?: string } }) {
    logger.info('Apple login attempt');

    const decoded = jwt.decode(idToken, { complete: true }) as { payload?: { sub?: string; email?: string } } | null;
    if (!decoded || !decoded.payload || !decoded.payload.sub) {
      throw new Error('Invalid Apple ID token');
    }

    const appleId = decoded.payload.sub as string;
    const tokenEmail = decoded.payload.email as string | undefined;
    const email = userData?.email || tokenEmail || '';
    const name = userData?.name
      ? `${userData.name.lastName || ''}${userData.name.firstName || ''}`.trim()
      : '';

    const existingAuth = await userRepository.findAuthAccount('apple', appleId);
    if (existingAuth) {
      const user = await userRepository.findById(existingAuth.userId);
      if (!user) {
        throw new Error('User not found');
      }
      if (user.isActive === false) {
        throw new Error('계정이 정지되었습니다. 관리자에게 문의하세요.');
      }

      const tokens = await this.generateTokensForUser(user);

      return {
        isNewUser: false,
        user: { id: user.id, email: user.email, role: user.role },
        ...tokens,
      };
    }

    if (email) {
      const existingUser = await userRepository.findByEmailIncludingDeleted(email);
      if (existingUser && !existingUser.deletedAt) {
        await userRepository.createAuthAccount({
          userId: existingUser.id,
          provider: 'apple',
          providerAccountId: appleId,
        });
        const tokens = await this.generateTokensForUser(existingUser);
        return {
          isNewUser: false,
          user: { id: existingUser.id, email: existingUser.email, role: existingUser.role },
          ...tokens,
        };
      }
    }

    // Apple Human Interface Guidelines: 사용자에게 다시 받지 말고 Apple 이 제공한 값(hidden relay 포함)을 그대로 사용한다.
    const isEmailHidden = !!email && email.includes('privaterelay.appleid.com');

    const onboardingToken = jwt.sign(
      { provider: 'apple', providerAccountId: appleId, email, name, isEmailHidden },
      process.env.JWT_SECRET!,
      { expiresIn: '30m' }
    );

    return {
      isNewUser: true,
      onboardingToken,
      socialProfile: {
        provider: 'apple' as const,
        providerAccountId: appleId,
        email,
        name,
        isEmailHidden,
      },
    };
  }

  async socialOnboarding(input: SocialOnboardingInput) {
    let tokenPayload: Record<string, unknown>;
    try {
      tokenPayload = jwt.verify(input.onboardingToken, process.env.JWT_SECRET!) as Record<string, unknown>;
    } catch {
      throw new Error('온보딩 토큰이 만료되었거나 유효하지 않습니다. 다시 소셜 로그인을 진행해주세요.');
    }

    const provider = tokenPayload.provider as 'google' | 'apple';
    const providerAccountId = tokenPayload.providerAccountId as string;
    const tokenEmail = tokenPayload.email as string;
    const tokenName = (tokenPayload.name as string) || '';
    const isEmailHidden = tokenPayload.isEmailHidden === true;

    // Apple HIG: Authentication Services 가 제공한 email/name 은 client 가 덮어쓰지 못하게 한다.
    // (Apple 이 값을 주지 않은 경우에만 client 가 보낸 fallback 사용)
    const email = provider === 'apple'
      ? (tokenEmail || input.email || '')
      : (input.email ? input.email : tokenEmail);
    const name = provider === 'apple'
      ? (tokenName || input.name || '')
      : input.name;

    logger.info('Social onboarding', { provider, email });

    const existingUser = await userRepository.findByEmailIncludingDeleted(email);
    if (existingUser) {
      if (existingUser.deletedAt) {
        const deletedAt = new Date(existingUser.deletedAt);
        const oneYearLater = new Date(deletedAt);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        if (new Date() < oneYearLater) {
          throw new Error('탈퇴한 계정의 이메일로는 1년간 재가입이 불가합니다.');
        }
      } else {
        throw new Error('이미 존재하는 이메일입니다.');
      }
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(randomPassword);

    const user = await userRepository.createUser({
      email,
      passwordHash,
      role: 'user',
    });

    await userRepository.createProfile({
      userId: user.id,
      nickname: input.nickname,
      name,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      language: input.language || 'ko',
    });

    await userRepository.createDefaultFolder(user.id);

    await userRepository.createAuthAccount({
      userId: user.id,
      provider,
      providerAccountId,
    });

    if (input.termsConsents.length > 0) {
      await termsConsentRepository.createMany(
        input.termsConsents.map((consent) => ({
          userId: user.id,
          termsType: consent.termsType,
          consented: consent.consented,
        }))
      );
    }

    const tokens = await this.generateTokensForUser(user);

    emailService.sendSignupNotification(user.email, input.nickname, input.language || 'ko').catch((err: unknown) => logger.warn('Signup notification email failed', { error: err instanceof Error ? err.message : String(err) }));

    return {
      user: { id: user.id, email: user.email, role: user.role },
      ...tokens,
    };
  }
}

export const authService = new AuthService();
