import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiRequest } from './api';

let isRegistered = false;

export async function initPushNotifications(navigate: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) return;
  if (isRegistered) return;

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    try {
      const platform = Capacitor.getPlatform() as 'android' | 'ios';
      await apiRequest('/push/register', {
        method: 'POST',
        body: JSON.stringify({ token: token.value, platform }),
      });
      isRegistered = true;
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration error:', error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    if (data?.type === 'inquiry_reply') {
      navigate('/my/support');
    } else if (data?.type === 'music_completed' && data?.jobId) {
      navigate(`/music/jobs/${data.jobId}`);
    }
  });
}

export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.removeAllListeners();
    isRegistered = false;
  } catch (error) {
    console.error('Failed to unregister push:', error);
  }
}
