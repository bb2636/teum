import { userRepository } from '../repositories/user.repository';
import { phoneVerificationRepository } from '../repositories/phone-verification.repository';
import { emailVerificationRepository } from '../repositories/email-verification.repository';
import { termsConsentRepository } from '../repositories/terms-consent.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, JWTPayload } from '../utils/jwt';
import { logger } from '../config/logger';
import {
  SignupInput,
  LoginInput,
  PhoneVerificationRequestInput,
  PhoneVerificationConfirmInput,
  EmailVerificationRequestInput,
  EmailVerificationConfirmInput,
} from '../validations/auth';

export class AuthService {
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

    // Create profile
    await userRepository.createProfile({
      userId: user.id,
      nickname: input.nickname,
      name: input.name,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      profileImageUrl: input.profileImageUrl || undefined,
      country: input.country,
    });

    // No longer create default "All" folder - users will see "전체" (All) option instead

    // Create auth account
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

    // Generate tokens
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
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

      // Generate tokens
      logger.debug('Generating tokens');
      const payload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      let accessToken: string;
      let refreshToken: string;
      
      try {
        accessToken = generateAccessToken(payload);
        refreshToken = generateRefreshToken(payload);
        logger.debug('Tokens generated successfully', { userId: user.id });
      } catch (tokenError) {
        logger.error('Token generation error', { error: tokenError, userId: user.id });
        throw new Error('Failed to generate authentication tokens');
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
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

  async requestPhoneVerification(input: PhoneVerificationRequestInput) {
    const lockStatus = await phoneVerificationRepository.isPhoneLocked(input.phone);
    if (lockStatus.locked) {
      const lockedUntil = lockStatus.lockedUntil!;
      const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`인증번호 입력 횟수를 초과했습니다. ${remainingMinutes}분 후에 다시 시도해주세요.`);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await phoneVerificationRepository.markAsExpired(input.phone);

    // Create new verification
    const verification = await phoneVerificationRepository.create({
      phone: input.phone,
      code,
      expiresAt,
    });

    // TODO: Send SMS (mock for now)
    // In development, log to logger and return code in response
    logger.info('Phone verification code generated', {
      phone: input.phone,
      code,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      message: 'Verification code sent',
      expiresIn: 600, // 10 minutes in seconds
    };
  }

  async confirmPhoneVerification(input: PhoneVerificationConfirmInput) {
    const lockStatus = await phoneVerificationRepository.isPhoneLocked(input.phone);
    if (lockStatus.locked) {
      const lockedUntil = lockStatus.lockedUntil!;
      const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`인증번호 입력 횟수를 초과했습니다. ${remainingMinutes}분 후에 다시 시도해주세요.`);
    }

    const verification = await phoneVerificationRepository.findValidCode(
      input.phone,
      input.code
    );

    if (!verification) {
      const pending = await phoneVerificationRepository.findPendingByPhone(input.phone);
      if (pending) {
        const updated = await phoneVerificationRepository.incrementFailedAttempts(pending.id);
        if (updated && updated.failedAttempts >= 5) {
          await phoneVerificationRepository.lockVerification(pending.id);
          throw new Error('인증번호 입력 횟수를 초과했습니다. 1시간 후에 다시 시도해주세요.');
        }
        const remaining = 5 - (updated?.failedAttempts || 0);
        throw new Error(`인증번호가 올바르지 않습니다. (남은 시도 횟수: ${remaining}회)`);
      }
      throw new Error('인증번호가 올바르지 않거나 만료되었습니다.');
    }

    await phoneVerificationRepository.markAsVerified(verification.id);

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

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Mark previous verifications as expired
    await emailVerificationRepository.markAsExpired(input.email);

    // Create new verification
    const verification = await emailVerificationRepository.create({
      email: input.email,
      code,
      expiresAt,
    });

    // TODO: Send email (mock for now)
    // In development, log to logger and return code in response
    logger.info('Email verification code generated', {
      email: input.email,
      code,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      message: 'Verification code sent',
      expiresIn: 600, // 10 minutes in seconds
      code, // Return code in development mode
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
    
    // Set expiration (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Mark previous verifications as expired
    await emailVerificationRepository.markAsExpired(input.email);

    // Create new verification
    const verification = await emailVerificationRepository.create({
      userId: existingUser.id,
      email: input.email,
      code,
      expiresAt,
    });

    // TODO: Send email (mock for now)
    // In development, log to logger and return code in response
    logger.info('Email verification code generated for password reset', {
      email: input.email,
      code,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      message: 'Verification code sent',
      expiresIn: 600, // 10 minutes in seconds
      code, // Return code in development mode
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
}

export const authService = new AuthService();
