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
    Camera: {
      ios: {
        usageDescription: '일기에 사진을 첨부하기 위해 카메라 접근 권한이 필요합니다.',
        photoLibraryUsageDescription: '일기에 사진을 첨부하기 위해 사진 라이브러리 접근 권한이 필요합니다.',
      },
    },
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
    AdMob: {
      appIdAndroid: 'ca-app-pub-3503508648798732~4006393534',
      appIdIos: 'ca-app-pub-3503508648798732~6807941370',
    },
  },
};

export default config;
