
/**
 * PWABuilder Detection and Management Utilities
 */

export interface PWABuilderInfo {
  isPWABuilder: boolean;
  platform: 'android' | 'ios' | 'windows' | 'web';
  version?: string;
  buildId?: string;
}

/**
 * Detect if the app is running in a PWABuilder environment
 */
export function detectPWABuilder(): PWABuilderInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInWebView = (window as any).webkit?.messageHandlers !== undefined || 
                     (window as any).Android !== undefined ||
                     userAgent.includes('wv');

  // Check for PWABuilder-specific indicators
  const isPWABuilderAndroid = userAgent.includes('pwabuilder') || 
                             (isInWebView && userAgent.includes('android') && isStandalone);
  
  const isPWABuilderWindows = userAgent.includes('edgewebview') || 
                             userAgent.includes('webview2');
  
  const isPWABuilderios = userAgent.includes('pwabuilder') && 
                         (userAgent.includes('iphone') || userAgent.includes('ipad'));

  let platform: 'android' | 'ios' | 'windows' | 'web' = 'web';
  let isPWABuilder = false;

  if (isPWABuilderAndroid) {
    platform = 'android';
    isPWABuilder = true;
  } else if (isPWABuilderios) {
    platform = 'ios';
    isPWABuilder = true;
  } else if (isPWABuilderWindows) {
    platform = 'windows';
    isPWABuilder = true;
  }

  console.log('[PWABuilder] Detection result:', {
    isPWABuilder,
    platform,
    userAgent,
    isStandalone,
    isInWebView
  });

  return {
    isPWABuilder,
    platform,
    version: getAppVersion(),
    buildId: getBuildId()
  };
}

/**
 * Get app version from manifest or package
 */
function getAppVersion(): string {
  try {
    // Try to get version from a global variable set during build
    const version = (window as any).__APP_VERSION__ || 
                   localStorage.getItem('app_version') || 
                   '1.0.0';
    return version;
  } catch (error) {
    console.error('[PWABuilder] Error getting app version:', error);
    return '1.0.0';
  }
}

/**
 * Get build ID from build process
 */
function getBuildId(): string {
  try {
    const buildId = (window as any).__BUILD_ID__ || 
                   localStorage.getItem('app_build_id') || 
                   Date.now().toString();
    return buildId;
  } catch (error) {
    console.error('[PWABuilder] Error getting build ID:', error);
    return Date.now().toString();
  }
}

/**
 * Configure PWABuilder-specific settings
 */
export function configurePWABuilderSettings(pwaInfo: PWABuilderInfo) {
  if (!pwaInfo.isPWABuilder) return;

  console.log('[PWABuilder] Configuring for platform:', pwaInfo.platform);

  // Platform-specific configurations
  switch (pwaInfo.platform) {
    case 'android':
      configureAndroidSettings();
      break;
    case 'ios':
      configureiOSSettings();
      break;
    case 'windows':
      configureWindowsSettings();
      break;
  }

  // Force aggressive cache refresh for PWABuilder apps
  forceAppRefresh();
}

function configureAndroidSettings() {
  // Android-specific settings
  document.body.classList.add('pwa-android');
  
  // Handle Android back button if available
  if ((window as any).AndroidInterface) {
    console.log('[PWABuilder] Android interface detected');
  }
}

function configureiOSSettings() {
  // iOS-specific settings
  document.body.classList.add('pwa-ios');
  
  // iOS viewport fixes
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );
  }
}

function configureWindowsSettings() {
  // Windows-specific settings
  document.body.classList.add('pwa-windows');
}

/**
 * Force app refresh and cache clearing
 */
function forceAppRefresh() {
  console.log('[PWABuilder] Forcing app refresh and cache clear');
  
  // Clear all localStorage except essential auth data
  const authData = localStorage.getItem('supabase.auth.token');
  const userId = localStorage.getItem('user_id');
  
  // Clear all localStorage
  localStorage.clear();
  
  // Restore only essential auth data
  if (authData) {
    localStorage.setItem('supabase.auth.token', authData);
  }
  if (userId) {
    localStorage.setItem('user_id', userId);
  }
  
  // Set cache bust timestamp
  localStorage.setItem('cache_bust_timestamp', Date.now().toString());
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Force service worker update
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.update();
      });
    });
  }
}
