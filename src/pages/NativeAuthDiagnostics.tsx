import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
import { nativeAuthService } from '@/services/nativeAuthService';
import { toast } from 'sonner';

const NativeAuthDiagnostics: React.FC = () => {
  const [state, setState] = useState({
    isNative: false,
    platform: 'web',
    googleAuthAvailable: false,
    initError: null as string | null,
    hasValidConfig: false,
    deviceInfo: null as any,
  });

  const refresh = () => {
    setState(s => ({
      ...s,
      isNative: nativeIntegrationService.isRunningNatively(),
      platform: nativeIntegrationService.getPlatform(),
      googleAuthAvailable: nativeIntegrationService.isGoogleAuthAvailable(),
      initError: nativeAuthService.getInitializationError(),
      hasValidConfig: nativeAuthService.hasValidConfiguration(),
      deviceInfo: nativeIntegrationService.getDeviceInfo(),
    }));
  };

  useEffect(() => {
    (async () => {
      await nativeIntegrationService.initialize();
      await nativeAuthService.initialize();
      refresh();
    })();
  }, []);

  const handleInit = async () => {
    try {
      await nativeIntegrationService.initialize();
      await nativeAuthService.initialize();
      refresh();
      toast.success('Initialization complete');
    } catch (e: any) {
      toast.error(`Init failed: ${e.message}`);
    }
  };

  const handleTestSignIn = async () => {
    try {
      await nativeAuthService.signInWithGoogle();
    } catch (e: any) {
      toast.error(e.message || 'Native sign-in failed');
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Native Auth Diagnostics</h1>
        <p className="text-sm opacity-80">Check native environment and Google Auth plugin status.</p>
      </header>

      <section className="space-y-3">
        <div className="p-4 rounded-md border">
          <div className="font-medium">Environment</div>
          <div>Native: {String(state.isNative)}</div>
          <div>Platform: {state.platform}</div>
          <div>GoogleAuth available: {String(state.googleAuthAvailable)}</div>
          <div>Valid config: {String(state.hasValidConfig)}</div>
          <div className="text-red-600">Init error: {state.initError || 'none'}</div>
        </div>

        <div className="p-4 rounded-md border">
          <div className="font-medium mb-2">Device Info</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(state.deviceInfo, null, 2)}</pre>
        </div>

        <div className="flex gap-3 mt-4">
          <Button onClick={handleInit}>Re-initialize</Button>
          <Button onClick={handleTestSignIn}>Test Native Google Sign-In</Button>
        </div>
      </section>
    </main>
  );
};

export default NativeAuthDiagnostics;
