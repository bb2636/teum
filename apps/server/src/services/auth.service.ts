import { userRepository } from '../repositories/user.repository';
import { phoneVerificationRepository } from '../repositories/phone-verification.repository';
import { termsConsentRepository } from '../repositories/terms-consent.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, JWTPayload } from '../utils/jwt';
import { logger } from '../config/logger';
import {
  SignupInput,
  LoginInput,
  PhoneVerificationRequestInput,
  PhoneVerificationConfirmInput,
} from '../validations/auth';

export class AuthService {
  async signup(input: SignupInput) {
    // Check if user already exists
    const existingUser = await userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
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

    // Create default folder
    await userRepository.createDefaultFolder(user.id);

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
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration (10 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Mark previous verifications as expired
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
    // Find valid verification
    const verification = await phoneVerificationRepository.findValidCode(
      input.phone,
      input.code
    );

    if (!verification) {
      throw new Error('Invalid or expired verification code');
    }

    // Mark as verified
    await phoneVerificationRepository.markAsVerified(verification.id);

    return {
      message: 'Phone number verified',
      verified: true,
    };
  }
}

export const authService = new AuthService();
