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
const ADMOB_IOS_INTERSTITIAL_ID = 'ca-app-pub-3503508648798732/6264812635';

function getInterstitialAdId(): string {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' ? ADMOB_IOS_INTERSTITIAL_ID : ADMOB_ANDROID_INTERSTITIAL_ID;
}

interface AdDebugInfo {
  platform: string;
  isNative: boolean;
  adUnitId: string;
  initialized: boolean;
  listenersRegistered: boolean;
  prepareCalled: boolean;
  loadedReceived: boolean;
  showCalled: boolean;
  failReason: string;
}

function createDebugInfo(): AdDebugInfo {
  return {
    platform: Capacitor.getPlatform(),
    isNative: Capacitor.isNativePlatform(),
    adUnitId: getInterstitialAdId(),
    initialized: false,
    listenersRegistered: false,
    prepareCalled: false,
    loadedReceived: false,
    showCalled: false,
    failReason: '',
  };
}

type AdFlowResult = { status: 'dismissed'; debug: AdDebugInfo } | { status: 'failed'; reason: string; debug: AdDebugInfo };

async function runNativeAdFlow(): Promise<AdFlowResult> {
  const debug = createDebugInfo();
  const L = (_msg: string, ..._args: unknown[]) => {};
  const W = (_msg: string, ..._args: unknown[]) => {};

  try {
    const { AdMob, InterstitialAdPluginEvents } = await import('@capacitor-community/admob');

    L('Step 1: AdMob.initialize START');
    try {
      await AdMob.initialize({ initializeForTesting: true });
      debug.initialized = true;
      L('Step 1: AdMob.initialize DONE');
    } catch (e) {
      debug.failReason = `initialize error: ${e}`;
      W('Step 1: AdMob.initialize FAILED:', e);
      return { status: 'failed', reason: debug.failReason, debug };
    }

    return await new Promise<AdFlowResult>(async (resolve) => {
      let settled = false;
      const handles: Array<{ remove: () => void }> = [];

      const settle = (status: 'dismissed' | 'failed', reason?: string) => {
        if (settled) return;
        settled = true;
        if (reason) debug.failReason = reason;
        L(`SETTLED: ${status}${reason ? ` (${reason})` : ''}`);
        handles.forEach((h) => { try { h.remove(); } catch (_) {} });
        if (status === 'dismissed') {
          resolve({ status: 'dismissed', debug });
        } else {
          resolve({ status: 'failed', reason: reason || 'unknown', debug });
        }
      };

      L('Step 2: Registering listeners...');

      const h1 = await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        debug.loadedReceived = true;
        L('EVENT: Loaded — calling showInterstitial');
        debug.showCalled = true;
        AdMob.showInterstitial().catch((e) => {
          W('showInterstitial threw:', e);
          settle('failed', `showInterstitial error: ${e}`);
        });
      });
      handles.push(h1);

      const h2 = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        L('EVENT: Dismissed — ad closed by user');
        settle('dismissed');
      });
      handles.push(h2);

      const h3 = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (info) => {
        const detail = JSON.stringify(info);
        W('EVENT: FailedToLoad', detail);
        settle('failed', `FailedToLoad: ${detail}`);
      });
      handles.push(h3);

      const h4 = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (info) => {
        const detail = JSON.stringify(info);
        W('EVENT: FailedToShow', detail);
        settle('failed', `FailedToShow: ${detail}`);
      });
      handles.push(h4);

      debug.listenersRegistered = true;
      L('Step 2: All 4 listeners registered');

      L('Step 3: prepareInterstitial START, adId =', debug.adUnitId);
      debug.prepareCalled = true;
      try {
        await AdMob.prepareInterstitial({ adId: debug.adUnitId });
        L('Step 3: prepareInterstitial resolved (waiting for Loaded event)');
      } catch (e) {
        W('Step 3: prepareInterstitial threw:', e);
        settle('failed', `prepareInterstitial error: ${e}`);
        return;
      }

      L(`Step 4: Timeout guard set (${AD_LOAD_TIMEOUT_MS}ms)`);
      setTimeout(() => {
        W('TIMEOUT: No Loaded/FailedToLoad within timeout');
        settle('failed', 'timeout (15s)');
      }, AD_LOAD_TIMEOUT_MS);
    });
  } catch (e) {
    debug.failReason = `exception: ${e}`;
    W('EXCEPTION in runNativeAdFlow:', e);
    return { status: 'failed', reason: debug.failReason, debug };
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

      runNativeAdFlow().then((result) => {
        adFlowRunningRef.current = false;
        if (result.status === 'dismissed') {
          if (!completedRef.current) {
            completedRef.current = true;
            onAdComplete();
          }
        } else {
          setShowFallback(true);
        }
      });
    } else {
      setShowFallback(true);
    }
  }, [isOpen, isNative, onAdComplete]);

  useEffect(() => {
    if (!showFallback) return;

    setCountdown(AD_DURATION_SECONDS);
    setCanSkip(false);

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
  }, [showFallback]);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onAdComplete();
  }, [onAdComplete]);

  if (!isOpen) return null;
  if (!showFallback) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center" onClick={canSkip ? onClose : undefined}>
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <div className="bg-gradient-to-br from-[#f5ede4] to-[#e8ddd1] p-6 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white/80 rounded-full flex items-center justify-center mb-3">
              <img
                src="/logo.png"
                alt="teum"
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <p className="text-lg font-semibold text-[#4A2C1A] text-center mb-1">
              teum
            </p>
            <p className="text-sm text-[#4A2C1A] text-center mb-3">
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
                ? 'bg-[#4A2C1A] text-white hover:bg-[#3A2010]'
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
