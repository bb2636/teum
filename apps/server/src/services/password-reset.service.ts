import { randomBytes } from 'crypto';
import { passwordResetRepository } from '../repositories/password-reset.repository';
import { userRepository } from '../repositories/user.repository';
import { phoneVerificationRepository } from '../repositories/phone-verification.repository';
import { hashPassword } from '../utils/password';
import { logger } from '../config/logger';
import { emailService } from './email/email.service';

export class PasswordResetService {
  async requestPasswordReset(email: string) {
    logger.info('Password reset requested', { email });

    // Find user by email
    const user = await passwordResetRepository.findUserByEmail(email);
    if (!user) {
      logger.warn('Password reset requested for non-existent email', { email });
      throw new Error('존재하지 않는 이메일입니다.');
    }

    // Generate reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token valid for 1 hour

    // Save token
    await passwordResetRepository.createToken({
      userId: user.id,
      token,
      expiresAt,
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password?token=${token}`;
    
    // Send email
    const emailEnabled = process.env.EMAIL_ENABLED === 'true';
    const isDevelopment = process.env.NODE_ENV !== 'production';
    let emailSent = false;
    
    if (emailEnabled) {
      try {
        await emailService.sendPasswordResetEmail(user.email, token);
        logger.info('Password reset email sent', { email });
        emailSent = true;
      } catch (error) {
        logger.error('Failed to send password reset email', {
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        // In production, don't return token if email fails (security)
        if (!isDevelopment) {
          // Still return success to not reveal if user exists
          return { success: true };
        }
      }
    } else {
      // Development mode: log token
      logger.info('Password reset token generated (email disabled)', {
        email,
        token, // Only in development
        resetLink,
      });
    }

    // Return token only in development mode or if email was sent successfully
    const shouldReturnToken = isDevelopment || (emailEnabled && emailSent);
    
    return {
      success: true,
      ...(shouldReturnToken && { token, resetLink }),
    };
  }

  async requestPasswordResetByPhone(email: string, phone: string) {
    logger.info('Password reset by phone requested', { email, phone });

    const recentVerification = await phoneVerificationRepository.findRecentVerified(phone, 10);
    if (!recentVerification) {
      throw new Error('전화번호 인증이 완료되지 않았습니다. 먼저 인증번호를 확인해주세요.');
    }

    const user = await userRepository.findByEmailAndPhone(email, phone);
    if (!user) {
      throw new Error('이메일과 전화번호가 일치하는 계정을 찾을 수 없습니다.');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await passwordResetRepository.createToken({
      userId: user.id,
      token,
      expiresAt,
    });

    logger.info('Password reset token generated via phone verification', { email });

    return { success: true, token };
  }

  async resetPassword(token: string, newPassword: string) {
    logger.info('Password reset attempted', { token: token.substring(0, 8) + '...' });

    // Find valid token
    const resetToken = await passwordResetRepository.findValidToken(token);
    if (!resetToken) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await userRepository.updatePassword(resetToken.userId, passwordHash);

    // Mark token as used
    await passwordResetRepository.markAsUsed(token);

    logger.info('Password reset successful', { userId: resetToken.userId });

    return { success: true };
  }
}

export const passwordResetService = new PasswordResetService();
