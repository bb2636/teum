import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/hooks/useTranslation';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdComplete: () => void;
}

const AD_DURATION_SECONDS = 5;

export function AdModal({ isOpen, onClose: _onClose, onAdComplete }: AdModalProps) {
  const t = useT();
  const [countdown, setCountdown] = useState(AD_DURATION_SECONDS);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(AD_DURATION_SECONDS);
      setCanSkip(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleComplete = useCallback(() => {
    onAdComplete();
  }, [onAdComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-xl">
        <div className="relative">
          <div className="bg-gradient-to-br from-[#f5ede4] to-[#e8ddd1] p-8 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center mb-4">
              <img
                src="/logo.png"
                alt="teum"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <p className="text-lg font-semibold text-[#4A2C1A] text-center mb-2">
              teum
            </p>
            <p className="text-sm text-[#665146] text-center">
              {t('diary.adRequiredMessage')}
            </p>
          </div>

          {!canSkip && (
            <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              {countdown}s
            </div>
          )}

          {canSkip && (
            <button
              onClick={handleComplete}
              className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4">
          <button
            onClick={canSkip ? handleComplete : undefined}
            disabled={!canSkip}
            className={`w-full py-3 rounded-full font-medium text-sm transition-colors ${
              canSkip
                ? 'bg-[#4A2C1A] text-white hover:bg-[#5A3C2A]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {canSkip ? t('diary.watchAd') : `${t('diary.watchAd')} (${countdown}s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
