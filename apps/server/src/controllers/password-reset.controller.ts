import { Request, Response, NextFunction } from 'express';
import { passwordResetService } from '../services/password-reset.service';
import { requestPasswordResetSchema, resetPasswordSchema } from '../validations/password-reset';

export class PasswordResetController {
  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const input = requestPasswordResetSchema.parse(req.body);
      const result = await passwordResetService.requestPasswordReset(input.email);

      // In development, include token for testing
      res.json({
        success: true,
        message: '비밀번호 재설정 이메일이 발송되었습니다',
        ...(result.token && { token: result.token, resetLink: result.resetLink }),
      });
    } catch (error) {
      if (error instanceof Error && error.message === '존재하지 않는 이메일입니다.') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_NOT_FOUND',
            message: '존재하지 않는 이메일입니다.',
          },
        });
      }
      next(error);
    }
  }

  async requestPasswordResetByPhone(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, phone } = req.body;
      if (!email || !phone) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: '이메일과 전화번호를 입력해주세요.' },
        });
      }
      const result = await passwordResetService.requestPasswordResetByPhone(email, phone);
      res.json({
        success: true,
        message: '비밀번호 재설정이 가능합니다.',
        token: result.token,
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = resetPasswordSchema.parse(req.body);
      await passwordResetService.resetPassword(input.token, input.password);

      res.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid or expired')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: '유효하지 않거나 만료된 토큰입니다',
          },
        });
      }
      next(error);
    }
  }
}

export const passwordResetController = new PasswordResetController();
