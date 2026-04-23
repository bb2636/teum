import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.teum.com',
  appName: 'TEUM',
  webDir: 'dist',
  android: {
    overrideUserAgent: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  },
  ios: {
    overrideUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
  server: {
    url: 'https://teum--iteraon.replit.app',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'appleid.apple.com',
      'accounts.google.com',
      '*.apple.com',
      '*.google.com',
      '*.gstatic.com',
      'teum--iteraon.replit.app',
      'pay.nicepay.co.kr',
      '*.nicepay.co.kr',
      '*.paypal.com',
      '*.paypalobjects.com',
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
    Camera: {
      ios: {
        usageDescription: '일기에 사진을 첨부하기 위해 카메라 접근 권한이 필요합니다.',
        photoLibraryUsageDescription: '일기에 사진을 첨부하기 위해 사진 라이브러리 접근 권한이 필요합니다.',
      },
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
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
