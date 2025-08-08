
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Native platform helpers for Capacitor environments
 * Keeps logic minimal and avoids throwing on web.
 */

export const isNativePlatform = Capacitor.isNativePlatform();
export const nativePlatform = Capacitor.getPlatform();

/**
 * Safely hides the splash screen if running natively.
 * Optionally waits for a short delay to ensure UI is mounted.
 */
export const hideSplashScreenSafe = async (delayMs: number = 0) => {
  if (!isNativePlatform) return;
  if (delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
  // SplashScreen plugin is available in native builds.
  await SplashScreen.hide();
};

/**
 * Convenience: schedule multiple attempts to hide splash to avoid race conditions
 * Useful for cases where React render or auth boot takes a moment.
 */
export const scheduleSplashHide = () => {
  if (!isNativePlatform) return;

  // Try at several stages
  requestAnimationFrame(() => hideSplashScreenSafe(0));
  setTimeout(() => hideSplashScreenSafe(0), 150);
  setTimeout(() => hideSplashScreenSafe(0), 400);
};

/**
 * Expose some debug info on window to help diagnose native boots.
 */
export const exposeNativeDebugInfo = () => {
  if (typeof window !== 'undefined') {
    // @ts-expect-error: debug fields
    window.__NATIVE__ = isNativePlatform;
    // @ts-expect-error: debug fields
    window.__PLATFORM__ = nativePlatform;
  }
};
