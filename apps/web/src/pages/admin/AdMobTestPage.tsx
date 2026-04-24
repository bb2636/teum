import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

interface StepResult {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail';
  detail?: string;
}

const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const LOAD_TIMEOUT_MS = 15000;

type ListenerHandle = { remove: () => void | Promise<void> };

export function AdMobTestPage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);

  const handlesRef = useRef<ListenerHandle[]>([]);
  const initializedRef = useRef(false);

  const cleanupListeners = async () => {
    const handles = handlesRef.current;
    handlesRef.current = [];
    for (const h of handles) {
      try {
        await h.remove();
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    return () => {
      void cleanupListeners();
    };
  }, []);

  const updateStep = (index: number, update: Partial<StepResult>) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
  };

  const markRemainingFail = (initialLen: number, fromIndex: number, reason = 'Skipped') => {
    for (let i = fromIndex; i < initialLen; i++) {
      updateStep(i, { status: 'fail', detail: reason });
    }
  };

  const runTest = async () => {
    if (running) return;
    setRunning(true);

    await cleanupListeners();

    const initial: StepResult[] = [
      { label: 'Platform Check', status: 'pending' },
      { label: 'Import Plugin', status: 'pending' },
      { label: 'AdMob.initialize()', status: 'pending' },
      { label: 'Register Listeners', status: 'pending' },
      { label: 'prepareInterstitial()', status: 'pending' },
      { label: 'Wait for Loaded event', status: 'pending' },
      { label: 'showInterstitial()', status: 'pending' },
    ];
    setSteps(initial);

    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    updateStep(0, {
      status: isNative ? 'ok' : 'fail',
      detail: `platform=${platform}, isNative=${isNative}`,
    });

    if (!isNative) {
      markRemainingFail(initial.length, 1, 'Skipped (not native)');
      setRunning(false);
      return;
    }

    type AdMobModule = typeof import('@capacitor-community/admob');
    let AdMob: AdMobModule['AdMob'];
    let InterstitialAdPluginEvents: AdMobModule['InterstitialAdPluginEvents'];

    updateStep(1, { status: 'running' });
    try {
      const mod = await import('@capacitor-community/admob');
      AdMob = mod.AdMob;
      InterstitialAdPluginEvents = mod.InterstitialAdPluginEvents;
      updateStep(1, { status: 'ok', detail: 'Plugin imported successfully' });
    } catch (e: unknown) {
      updateStep(1, { status: 'fail', detail: `Import failed: ${e instanceof Error ? e.message : String(e)}` });
      markRemainingFail(initial.length, 2);
      setRunning(false);
      return;
    }

    updateStep(2, { status: 'running' });
    try {
      if (!initializedRef.current) {
        await AdMob.initialize({ initializeForTesting: true });
        initializedRef.current = true;
        updateStep(2, { status: 'ok', detail: 'MobileAds initialized' });
      } else {
        updateStep(2, { status: 'ok', detail: 'Already initialized (reused)' });
      }
    } catch (e: unknown) {
      updateStep(2, { status: 'fail', detail: e instanceof Error ? e.message : String(e) });
      markRemainingFail(initial.length, 3);
      setRunning(false);
      return;
    }

    updateStep(3, { status: 'running' });

    let resolveLoad: () => void = () => {};
    let rejectLoad: (err: Error) => void = () => {};
    const loadPromise = new Promise<void>((resolve, reject) => {
      resolveLoad = resolve;
      rejectLoad = reject;
    });

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let loadSettled = false;
    const settleLoad = (fn: () => void) => {
      if (loadSettled) return;
      loadSettled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      fn();
    };

    let showSettled = false;
    let resolveShow: () => void = () => {};
    let rejectShow: (err: Error) => void = () => {};
    const showCompletePromise = new Promise<void>((resolve, reject) => {
      resolveShow = resolve;
      rejectShow = reject;
    });
    const settleShow = (fn: () => void) => {
      if (showSettled) return;
      showSettled = true;
      fn();
    };

    try {
      const h1 = await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        settleLoad(() => resolveLoad());
      });
      handlesRef.current.push(h1);

      const h2 = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (info: unknown) => {
        settleLoad(() => rejectLoad(new Error(`FailedToLoad: ${JSON.stringify(info)}`)));
      });
      handlesRef.current.push(h2);

      const h3 = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (info: unknown) => {
        settleShow(() => rejectShow(new Error(`FailedToShow: ${JSON.stringify(info)}`)));
      });
      handlesRef.current.push(h3);

      const h4 = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        settleShow(() => resolveShow());
      });
      handlesRef.current.push(h4);

      updateStep(3, { status: 'ok', detail: '4 listeners registered (Loaded/FailedToLoad/FailedToShow/Dismissed)' });
    } catch (e: unknown) {
      updateStep(3, { status: 'fail', detail: e instanceof Error ? e.message : String(e) });
      await cleanupListeners();
      markRemainingFail(initial.length, 4);
      setRunning(false);
      return;
    }

    updateStep(4, { status: 'running', detail: `adId: ${TEST_INTERSTITIAL_ID}` });
    try {
      await AdMob.prepareInterstitial({ adId: TEST_INTERSTITIAL_ID });
      updateStep(4, { status: 'ok', detail: 'prepareInterstitial resolved' });
    } catch (e: unknown) {
      updateStep(4, { status: 'fail', detail: e instanceof Error ? e.message : String(e) });
      await cleanupListeners();
      markRemainingFail(initial.length, 5);
      setRunning(false);
      return;
    }

    updateStep(5, { status: 'running', detail: 'Waiting for Loaded event...' });
    timeoutHandle = setTimeout(() => {
      settleLoad(() => rejectLoad(new Error(`Timeout (${LOAD_TIMEOUT_MS / 1000}s)`)));
    }, LOAD_TIMEOUT_MS);

    try {
      await loadPromise;
      updateStep(5, { status: 'ok', detail: 'Loaded event received' });
    } catch (e: unknown) {
      updateStep(5, { status: 'fail', detail: e instanceof Error ? e.message : String(e) });
      await cleanupListeners();
      markRemainingFail(initial.length, 6);
      setRunning(false);
      return;
    }

    updateStep(6, { status: 'running', detail: 'Calling showInterstitial...' });
    try {
      await AdMob.showInterstitial();
      try {
        await showCompletePromise;
        updateStep(6, { status: 'ok', detail: 'Ad shown and dismissed' });
      } catch (e: unknown) {
        updateStep(6, { status: 'fail', detail: e instanceof Error ? e.message : String(e) });
      }
    } catch (e: unknown) {
      updateStep(6, { status: 'fail', detail: `show error: ${e instanceof Error ? e.message : String(e)}` });
    }

    await cleanupListeners();
    setRunning(false);
  };

  const statusIcon = (s: StepResult['status']) => {
    switch (s) {
      case 'pending': return '⏸';
      case 'running': return '⏳';
      case 'ok': return '✅';
      case 'fail': return '❌';
    }
  };

  const statusColor = (s: StepResult['status']) => {
    switch (s) {
      case 'pending': return 'text-gray-400';
      case 'running': return 'text-blue-600';
      case 'ok': return 'text-green-700';
      case 'fail': return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="flex items-center px-4 py-3 border-b" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-[#4A2C1A]" />
          </button>
          <h1 className="flex-1 text-center text-base font-semibold text-[#4A2C1A]">AdMob Test</h1>
          <div className="w-10" />
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-1">
            <div>platform: <b>{Capacitor.getPlatform()}</b></div>
            <div>isNative: <b>{String(Capacitor.isNativePlatform())}</b></div>
            <div>testAdId: <b>{TEST_INTERSTITIAL_ID}</b></div>
          </div>

          <button
            onClick={runTest}
            disabled={running}
            className={`w-full py-3 rounded-full font-medium text-sm transition-colors ${
              running
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#4A2C1A] text-white hover:bg-[#3A2010]'
            }`}
          >
            {running ? 'Testing...' : 'Run AdMob Test'}
          </button>

          {steps.length > 0 && (
            <div className="border rounded-lg divide-y">
              {steps.map((step, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{statusIcon(step.status)}</span>
                    <span className={`text-sm font-medium ${statusColor(step.status)}`}>
                      Step {i + 1}: {step.label}
                    </span>
                  </div>
                  {step.detail && (
                    <p className="mt-1 ml-6 text-[10px] font-mono text-gray-500 break-all">
                      {step.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
