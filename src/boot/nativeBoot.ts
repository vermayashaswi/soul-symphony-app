
import { exposeNativeDebugInfo, isNativePlatform, nativePlatform, scheduleSplashHide } from '@/lib/native';
import { nativeIntegrationService } from '@/services/nativeIntegrationService';
/**
 * Runs as early as possible on app startup to reduce chances of blank screen on native.
 * It only runs any action if we're in a native environment.
 */

declare global {
  interface Window {
    __APP_READY__?: boolean;
    __NATIVE__?: boolean;
    __PLATFORM__?: string;
  }
}

const runNativeBoot = () => {
  exposeNativeDebugInfo();

  // Unconditionally attempt early native integration init with a short timeout
  try {
    const initPromise = nativeIntegrationService.initialize();
    Promise.race([
      initPromise,
      new Promise((resolve) => setTimeout(resolve, 1200))
    ])
      .then(() => {
        console.log('[nativeBoot] nativeIntegrationService init attempted');
      })
      .catch((e) => {
        console.warn('[nativeBoot] nativeIntegrationService init error', e);
      });
  } catch (e) {
    console.warn('[nativeBoot] nativeIntegrationService init threw', e);
  }

  if (!isNativePlatform) {
    // Web: no splash to manage
    return;
  }

  console.log('[nativeBoot] Detected native platform:', nativePlatform);

  const onReady = () => {
    if (window.__APP_READY__) return;
    window.__APP_READY__ = true;
    console.log('[nativeBoot] App ready, scheduling splash hide...');
    scheduleSplashHide();
  };

  // If document is already parsed, proceed; otherwise attach listeners
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    onReady();
  } else {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  }

  // As a fallback, also run after full load
  window.addEventListener('load', () => {
    console.log('[nativeBoot] Window load event, scheduling splash hide...');
    scheduleSplashHide();
  }, { once: true });
};

runNativeBoot();
