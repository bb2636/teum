import { randomBytes } from 'crypto';
import { passwordResetRepository } from '../repositories/password-reset.repository';
import { userRepository } from '../repositories/user.repository';
import { hashPassword } from '../utils/password';
import { logger } from '../config/logger';
import { emailService } from './email/email.service';

export class PasswordResetService {
  async requestPasswordReset(email: string) {
    logger.info('Password reset requested', { email });

    // Find user by email
    const user = await passwordResetRepository.findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      logger.warn('Password reset requested for non-existent email', { email });
      return { success: true }; // Always return success
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
    if (emailEnabled) {
      try {
        await emailService.sendPasswordResetEmail(user.email, token);
        logger.info('Password reset email sent', { email });
      } catch (error) {
        logger.error('Failed to send password reset email', {
          email,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue even if email fails - don't reveal if user exists
      }
    } else {
      // Development mode: log token
      logger.info('Password reset token generated (email disabled)', {
        email,
        token, // Only in development
        resetLink,
      });
    }

    // In development, return token for testing (only if email is disabled)
    const isDevelopment = process.env.NODE_ENV !== 'production' && !emailEnabled;
    return {
      success: true,
      ...(isDevelopment && { token, resetLink }),
    };
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
