import * as admin from 'firebase-admin';
import { logger } from '../config/logger';
import { deviceTokenRepository } from '../repositories/device-token.repository';

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT not configured, push notifications disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('Firebase Admin initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin', { error });
    return null;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class PushNotificationService {
  async registerToken(userId: string, token: string, platform: 'android' | 'ios' | 'web') {
    return deviceTokenRepository.upsertToken(userId, token, platform);
  }

  async unregisterToken(userId: string, token: string) {
    return deviceTokenRepository.removeToken(userId, token);
  }

  async sendToUser(userId: string, payload: PushNotificationPayload) {
    const app = getFirebaseApp();
    if (!app) {
      logger.warn('Push notification skipped - Firebase not configured', { userId, title: payload.title });
      return;
    }

    const tokens = await deviceTokenRepository.getTokensByUserId(userId);
    if (tokens.length === 0) {
      logger.info('No device tokens found for user', { userId });
      return;
    }

    const messaging = admin.messaging(app);
    const tokenStrings = tokens.map((t) => t.token);

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: tokenStrings,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'teum_default',
            sound: 'default',
          },
        },
      });

      logger.info('Push notification sent', {
        userId,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });

      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              failedTokens.push(tokenStrings[idx]);
            }
          }
        });

        for (const failedToken of failedTokens) {
          await deviceTokenRepository.removeToken(userId, failedToken);
          logger.info('Removed invalid device token', { userId, token: failedToken.slice(0, 10) + '...' });
        }
      }
    } catch (error) {
      logger.error('Failed to send push notification', { userId, error });
    }
  }
}

export const pushNotificationService = new PushNotificationService();
