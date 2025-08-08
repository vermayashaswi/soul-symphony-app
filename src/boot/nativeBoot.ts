
import { exposeNativeDebugInfo, isNativePlatform, nativePlatform, scheduleSplashHide } from '@/lib/native';

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

  if (!isNativePlatform) {
    // No-op on web
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
