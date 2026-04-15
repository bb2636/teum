import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

interface StepResult {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail';
  detail?: string;
}

export function AdMobTestPage() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);

  const updateStep = (index: number, update: Partial<StepResult>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...update } : s));
  };

  const runTest = async () => {
    if (running) return;
    setRunning(true);

    const initial: StepResult[] = [
      { label: 'Platform Check', status: 'pending' },
      { label: 'Import Plugin', status: 'pending' },
      { label: 'AdMob.initialize()', status: 'pending' },
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
      for (let i = 1; i < initial.length; i++) {
        updateStep(i, { status: 'fail', detail: 'Skipped (not native)' });
      }
      setRunning(false);
      return;
    }

    let AdMob: any;
    let InterstitialAdPluginEvents: any;

    updateStep(1, { status: 'running' });
    try {
      const mod = await import('@capacitor-community/admob');
      AdMob = mod.AdMob;
      InterstitialAdPluginEvents = mod.InterstitialAdPluginEvents;
      updateStep(1, { status: 'ok', detail: 'Plugin imported successfully' });
    } catch (e: unknown) {
      updateStep(1, { status: 'fail', detail: `Import failed: ${e instanceof Error ? e.message : String(e)}` });
      for (let i = 2; i < initial.length; i++) {
        updateStep(i, { status: 'fail', detail: 'Skipped' });
      }
      setRunning(false);
      return;
    }

    updateStep(2, { status: 'running' });
    try {
      await AdMob.initialize({ initializeForTesting: true });
      updateStep(2, { status: 'ok', detail: 'MobileAds initialized' });
    } catch (e: unknown) {
      updateStep(2, { status: 'fail', detail: `${e instanceof Error ? e.message : String(e)}` });
      for (let i = 3; i < initial.length; i++) {
        updateStep(i, { status: 'fail', detail: 'Skipped' });
      }
      setRunning(false);
      return;
    }

    const adId = 'ca-app-pub-3940256099942544/1033173712';
    updateStep(3, { status: 'running', detail: `adId: ${adId}` });

    try {
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout 15s')), 15000);
        const handles: any[] = [];

        AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
          clearTimeout(timeout);
          handles.forEach((h: any) => { try { h.remove(); } catch (_) {} });
          resolve();
        }).then((h: any) => handles.push(h));

        AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (info: any) => {
          clearTimeout(timeout);
          handles.forEach((h: any) => { try { h.remove(); } catch (_) {} });
          reject(new Error(`FailedToLoad: ${JSON.stringify(info)}`));
        }).then((h: any) => handles.push(h));
      });

      await AdMob.prepareInterstitial({ adId });
      updateStep(3, { status: 'ok', detail: `prepareInterstitial resolved, adId: ${adId}` });

      updateStep(4, { status: 'running', detail: 'Waiting for Loaded event...' });
      await loadPromise;
      updateStep(4, { status: 'ok', detail: 'Loaded event received' });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('FailedToLoad')) {
        updateStep(3, { status: 'ok', detail: `prepareInterstitial resolved, adId: ${adId}` });
        updateStep(4, { status: 'fail', detail: msg });
      } else if (msg.includes('Timeout')) {
        updateStep(3, { status: 'ok', detail: `prepareInterstitial resolved, adId: ${adId}` });
        updateStep(4, { status: 'fail', detail: msg });
      } else {
        updateStep(3, { status: 'fail', detail: msg });
        updateStep(4, { status: 'fail', detail: 'Skipped' });
      }
      updateStep(5, { status: 'fail', detail: 'Skipped' });
      setRunning(false);
      return;
    }

    updateStep(5, { status: 'running' });
    try {
      await AdMob.showInterstitial();
      updateStep(5, { status: 'ok', detail: 'Ad shown successfully' });
    } catch (e: unknown) {
      updateStep(5, { status: 'fail', detail: `${e instanceof Error ? e.message : String(e)}` });
    }

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
            <div>testAdId: <b>ca-app-pub-3940256099942544/1033173712</b></div>
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
