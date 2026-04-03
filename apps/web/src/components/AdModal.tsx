import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/hooks/useTranslation';
import { Capacitor } from '@capacitor/core';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdComplete: () => void;
}

const AD_DURATION_SECONDS = 5;
const AD_LOAD_TIMEOUT_MS = 15000;
const ADMOB_ANDROID_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const ADMOB_IOS_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

function getInterstitialAdId(): string {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' ? ADMOB_IOS_INTERSTITIAL_ID : ADMOB_ANDROID_INTERSTITIAL_ID;
}

type AdFlowResult = { status: 'dismissed' } | { status: 'failed'; reason: string };

async function runNativeAdFlow(): Promise<AdFlowResult> {
  const L = (msg: string, ...args: any[]) => console.log(`[AdFlow] ${msg}`, ...args);
  const W = (msg: string, ...args: any[]) => console.warn(`[AdFlow] ${msg}`, ...args);

  try {
    const { AdMob, InterstitialAdPluginEvents } = await import('@capacitor-community/admob');

    L('Step 1/5: AdMob.initialize START');
    await AdMob.initialize({ initializeForTesting: true });
    L('Step 1/5: AdMob.initialize DONE');

    return await new Promise<AdFlowResult>(async (resolve) => {
      let settled = false;
      const handles: Array<{ remove: () => void }> = [];

      const settle = (result: AdFlowResult) => {
        if (settled) return;
        settled = true;
        L(`SETTLED: ${result.status}${result.status === 'failed' ? ` (${result.reason})` : ''}`);
        handles.forEach((h) => { try { h.remove(); } catch (_) {} });
        resolve(result);
      };

      L('Step 3/5: Registering listeners...');

      const h1 = await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        L('EVENT: Loaded — calling showInterstitial');
        AdMob.showInterstitial().catch((e) => {
          W('showInterstitial threw:', e);
          settle({ status: 'failed', reason: `showInterstitial error: ${e}` });
        });
      });
      handles.push(h1);

      const h2 = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        L('EVENT: Dismissed — ad closed by user');
        settle({ status: 'dismissed' });
      });
      handles.push(h2);

      const h3 = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (info: any) => {
        W('EVENT: FailedToLoad', JSON.stringify(info));
        settle({ status: 'failed', reason: `FailedToLoad: ${JSON.stringify(info)}` });
      });
      handles.push(h3);

      const h4 = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (info: any) => {
        W('EVENT: FailedToShow', JSON.stringify(info));
        settle({ status: 'failed', reason: `FailedToShow: ${JSON.stringify(info)}` });
      });
      handles.push(h4);

      L('Step 3/5: All 4 listeners registered');

      L('Step 4/5: prepareInterstitial START, adId =', getInterstitialAdId());
      try {
        await AdMob.prepareInterstitial({ adId: getInterstitialAdId() });
        L('Step 4/5: prepareInterstitial promise resolved (waiting for Loaded event)');
      } catch (e) {
        W('Step 4/5: prepareInterstitial threw:', e);
        settle({ status: 'failed', reason: `prepareInterstitial error: ${e}` });
        return;
      }

      L(`Step 5/5: Timeout guard set (${AD_LOAD_TIMEOUT_MS}ms)`);
      setTimeout(() => {
        W('TIMEOUT: No Loaded/FailedToLoad within timeout');
        settle({ status: 'failed', reason: 'timeout' });
      }, AD_LOAD_TIMEOUT_MS);
    });
  } catch (e) {
    console.warn(`[AdFlow] EXCEPTION in runNativeAdFlow:`, e);
    return { status: 'failed', reason: `exception: ${e}` };
  }
}

export function AdModal({ isOpen, onClose, onAdComplete }: AdModalProps) {
  const t = useT();
  const [countdown, setCountdown] = useState(AD_DURATION_SECONDS);
  const [canSkip, setCanSkip] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const adFlowRunningRef = useRef(false);
  const completedRef = useRef(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isOpen) {
      setCountdown(AD_DURATION_SECONDS);
      setCanSkip(false);
      setShowFallback(false);
      adFlowRunningRef.current = false;
      completedRef.current = false;
      return;
    }

    if (adFlowRunningRef.current) return;

    if (isNative) {
      adFlowRunningRef.current = true;
      console.log('[AdFlow] Native platform — starting ad flow');

      runNativeAdFlow().then((result) => {
        adFlowRunningRef.current = false;
        if (result.status === 'dismissed') {
          console.log('[AdFlow] Ad dismissed → calling onAdComplete (saveDiary)');
          if (!completedRef.current) {
            completedRef.current = true;
            onAdComplete();
          }
        } else {
          console.warn('[AdFlow] Ad failed:', result.reason, '→ showing fallback UI');
          setShowFallback(true);
        }
      });
    } else {
      console.log('[AdFlow] Web platform — showing fallback UI directly');
      setShowFallback(true);
    }
  }, [isOpen, isNative, onAdComplete]);

  useEffect(() => {
    if (!showFallback) return;

    console.log('[AdFlow] Fallback UI visible — countdown START');
    setCountdown(AD_DURATION_SECONDS);
    setCanSkip(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          console.log('[AdFlow] Countdown done — user can skip');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showFallback]);

  const handleComplete = useCallback(() => {
    if (completedRef.current) {
      console.log('[AdFlow] handleComplete called but already completed — ignoring');
      return;
    }
    completedRef.current = true;
    console.log('[AdFlow] Fallback complete → calling onAdComplete (saveDiary)');
    onAdComplete();
  }, [onAdComplete]);

  if (!isOpen) return null;

  if (!showFallback) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center" onClick={canSkip ? onClose : undefined}>
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
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
