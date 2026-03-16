import { userRepository } from '../repositories/user.repository';
import { phoneVerificationRepository } from '../repositories/phone-verification.repository';
import { termsConsentRepository } from '../repositories/terms-consent.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, JWTPayload } from '../utils/jwt';
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
      console.log('AuthService.login - Finding user:', input.email);
      
      // Find user
      const user = await userRepository.findByEmail(input.email);
      console.log('User found:', user ? { id: user.id, email: user.email, hasPassword: !!user.passwordHash } : 'null');
      
      if (!user || !user.passwordHash) {
        console.log('User not found or no password hash');
        throw new Error('Invalid email or password');
      }

      // Verify password
      console.log('Comparing password...');
      const isValid = await comparePassword(input.password, user.passwordHash);
      console.log('Password comparison result:', isValid);
      
      if (!isValid) {
        console.log('Password mismatch');
        throw new Error('Invalid email or password');
      }

      // Generate tokens
      console.log('Generating tokens...');
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
        console.log('Tokens generated successfully');
      } catch (tokenError) {
        console.error('Token generation error:', tokenError);
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
      console.error('Login error in AuthService:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
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
    // In development, log to console and return code in response
    console.log(`\n========================================`);
    console.log(`📱 휴대폰 인증번호 발송`);
    console.log(`전화번호: ${input.phone}`);
    console.log(`인증번호: ${code}`);
    console.log(`만료시간: ${expiresAt.toLocaleString('ko-KR')}`);
    console.log(`========================================\n`);

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
