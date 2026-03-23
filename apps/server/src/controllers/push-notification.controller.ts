import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pushNotificationService } from '../services/push-notification.service';

const registerTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  platform: z.enum(['android', 'ios', 'web']),
});

const unregisterTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export class PushNotificationController {
  async registerToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { token, platform } = registerTokenSchema.parse(req.body);

      const result = await pushNotificationService.registerToken(userId, token, platform);

      res.json({
        success: true,
        data: { id: result.id },
      });
    } catch (error) {
      next(error);
    }
  }

  async unregisterToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { token } = unregisterTokenSchema.parse(req.body);

      await pushNotificationService.unregisterToken(userId, token);

      res.json({
        success: true,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const pushNotificationController = new PushNotificationController();
