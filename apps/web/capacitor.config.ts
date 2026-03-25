import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.teum.app',
  appName: 'Teum',
  webDir: 'dist',
  server: {
    url: 'https://teum.replit.app',
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#F5F1EB',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
