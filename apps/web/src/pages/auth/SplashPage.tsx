import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

export function SplashPage() {
  const navigate = useNavigate();

  // 스크롤 방지 및 모바일 화면 크기 고정
  useEffect(() => {
    // 스크롤 방지
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';

    // cleanup: 페이지를 벗어날 때 스크롤 복원
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm h-screen bg-[#6B4423] relative overflow-visible md:overflow-hidden flex flex-col items-center justify-center px-4" style={{ touchAction: 'none' }}>
        {/* 카메라 이미지 - 오른쪽 위 */}
        <div className="absolute top-4 md:top-0 right-0 z-10 flex justify-end">
          <img
            src="/camera.png"
            alt="camera"
            className="w-1/2 h-auto object-contain"
            onError={(e) => {
              // Fallback if camera image doesn't exist - hide the image
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div className="w-full flex flex-col items-center justify-center space-y-6">
          {/* Logo and Tagline Section - 중앙 */}
          <div className="flex flex-col justify-center items-center text-center space-y-2">
            <div className="[&_h1]:text-[#4A2C1A]">
              <Logo size="md" showText={true} />
            </div>
            <p className="text-[#4A2C1A] text-sm">
              기록이 곧, 당신만의 트랙이 됩니다.
            </p>
          </div>

          {/* Login Options Section */}
          <div className="w-full space-y-4">
            {/* Email Login Button */}
            <Button
              className="w-full bg-[#8B4513] text-white hover:bg-[#7B3F00] rounded-xl py-4 text-base font-medium"
              size="lg"
              onClick={() => navigate('/login')}
            >
              이메일로 로그인
            </Button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/30"></div>
              </div>
              <div className="relative bg-[#6B4423] px-4">
                <span className="text-white/80 text-sm">또는</span>
              </div>
            </div>

            {/* Social Login Icons */}
            <div className="flex justify-center items-center gap-6">
              {/* Google Login */}
              <button
                onClick={() => {
                  // TODO: Google login 구현
                  console.log('Google login');
                }}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors shadow-md"
                aria-label="Google로 로그인"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </button>

              {/* Apple Login */}
              <button
                onClick={() => {
                  // TODO: Apple login 구현
                  console.log('Apple login');
                }}
                className="w-14 h-14 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors shadow-md"
                aria-label="Apple로 로그인"
              >
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
