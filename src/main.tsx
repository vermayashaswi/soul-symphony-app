import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { TranslationProvider } from './contexts/TranslationContext'
import { ContextReadinessProvider } from './contexts/ContextReadinessManager'
import { ThemeProvider } from './hooks/use-theme'
import { initializeServiceWorker } from './utils/serviceWorker'
import { backgroundSyncService } from './services/backgroundSyncService'
import { periodicSyncService } from './services/periodicSyncService'
import { pushNotificationService } from './services/pushNotificationService'
import { mobileErrorHandler } from './services/mobileErrorHandler'
import { mobileOptimizationService } from './services/mobileOptimizationService'
import { nativeIntegrationService } from './services/nativeIntegrationService'

// Capacitor imports for mobile functionality
import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { App as CapacitorApp } from '@capacitor/app'

// Enhanced Font Loading System
const initializeFontSystem = async () => {
  console.log('[FontSystem] Starting font initialization...');
  
  // Core fonts that must be loaded
  const coreFonts = [
    'Inter',
    'Noto Sans',
    'Noto Sans Devanagari',
    'Noto Sans Arabic',
    'Noto Sans SC',
    'Noto Sans JP',
    'Noto Sans KR',
    'Noto Sans Bengali',
    'Noto Sans Thai'
  ];
  
  // Font loading with timeout and retry
  const loadFontWithRetry = async (fontFamily: string, retries = 3): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        if (document.fonts && document.fonts.check) {
          const isLoaded = document.fonts.check(`12px "${fontFamily}"`);
          if (isLoaded) {
            console.log(`[FontSystem] ${fontFamily} already loaded`);
            return true;
          }
          
          // Wait for font to load with timeout
          const fontFace = new FontFace(fontFamily, `local("${fontFamily}")`);
          await Promise.race([
            fontFace.load(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          
          console.log(`[FontSystem] ${fontFamily} loaded successfully`);
          return true;
        }
      } catch (error) {
        console.warn(`[FontSystem] Attempt ${i + 1} failed for ${fontFamily}:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    console.error(`[FontSystem] Failed to load ${fontFamily} after ${retries} attempts`);
    return false;
  };
  
  // Load core fonts
  const fontPromises = coreFonts.map(font => loadFontWithRetry(font));
  
  try {
    // Wait for document fonts ready with timeout
    await Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    const results = await Promise.allSettled(fontPromises);
    const loadedCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    console.log(`[FontSystem] Font loading complete: ${loadedCount}/${coreFonts.length} fonts loaded`);
    
    // Set global font ready flag
    (window as any).__SOULO_FONTS_READY__ = true;
    
    // Dispatch font ready event
    window.dispatchEvent(new CustomEvent('fontsReady', { 
      detail: { 
        loadedCount, 
        totalCount: coreFonts.length,
        timestamp: Date.now()
      } 
    }));
    
  } catch (error) {
    console.error('[FontSystem] Font initialization error:', error);
    // Set ready flag anyway to prevent hanging
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady', { detail: { error } }));
  }
};

// Capacitor Mobile Initialization
const initializeCapacitor = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Capacitor] Running in web mode, skipping native initialization');
    return;
  }

  console.log('[Capacitor] Initializing native platform features...');

  try {
    // Configure status bar for dark theme
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
    console.log('[Capacitor] Status bar configured');

    // Set up app state listeners
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      console.log('[Capacitor] App state changed:', isActive ? 'active' : 'background');
      if (isActive) {
        // App came to foreground
        document.dispatchEvent(new CustomEvent('appStateChange', { detail: { isActive: true } }));
      } else {
        // App went to background
        document.dispatchEvent(new CustomEvent('appStateChange', { detail: { isActive: false } }));
      }
    });

    // Handle deep links
    CapacitorApp.addListener('appUrlOpen', (event) => {
      console.log('[Capacitor] Deep link received:', event.url);
      
      // Handle OAuth redirects
      if (event.url.includes('/app/auth') || event.url.includes('soulo://auth')) {
        console.log('[Capacitor] OAuth redirect detected');
        window.dispatchEvent(new CustomEvent('oauthRedirect', { detail: { url: event.url } }));
      }
    });

    // Handle back button
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      console.log('[Capacitor] Back button pressed, canGoBack:', canGoBack);
      
      if (!canGoBack) {
        // Show exit confirmation or minimize app
        CapacitorApp.minimizeApp();
      } else {
        // Let the browser handle the back navigation
        window.history.back();
      }
    });

    console.log('[Capacitor] Native initialization complete');

  } catch (error) {
    console.error('[Capacitor] Initialization error:', error);
    mobileErrorHandler.handleError({
      type: 'unknown',
      message: `Capacitor initialization failed: ${error}`
    });
  }
};

// Enhanced Splash Screen Management
const manageSplashScreen = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    console.log('[SplashScreen] Managing splash screen...');
    
    // Keep splash screen visible during initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Hide splash screen with fade animation
    await SplashScreen.hide();
    console.log('[SplashScreen] Splash screen hidden');
    
  } catch (error) {
    console.error('[SplashScreen] Error managing splash screen:', error);
    // Try to hide splash screen anyway
    try {
      await SplashScreen.hide();
    } catch (fallbackError) {
      console.error('[SplashScreen] Fallback hide failed:', fallbackError);
    }
  }
};

// iOS Viewport Height Fix - addresses the iOS Safari issue with viewport height
const fixViewportHeight = () => {
  // Set CSS variable for viewport height that updates on resize
  const setVhProperty = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  // Initial set
  setVhProperty();
  
  // Update on resize and orientation change
  window.addEventListener('resize', setVhProperty);
  window.addEventListener('orientationchange', () => {
    // Slight delay to ensure viewport has updated after orientation change
    setTimeout(setVhProperty, 100);
  });
  
  // Special handling for iOS keyboard appearance
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    
    // Track when iOS keyboard shows/hides by monitoring input focus
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        document.body.classList.add('keyboard-visible');
        // Force reflow to ensure transition works
        setTimeout(() => {
          window.scrollTo(0, 0);
          setVhProperty();
        }, 50);
      });
      
      input.addEventListener('blur', () => {
        document.body.classList.remove('keyboard-visible');
        // Small delay to ensure UI updates after keyboard hides
        setTimeout(setVhProperty, 50);
      });
    });
  }
};

// Initialize PWA Service Worker
const initializePWA = async () => {
  try {
    console.log('[PWA] Initializing service worker...');
    
    const result = await initializeServiceWorker();
    
    if (result.success) {
      console.log('[PWA] Service worker registered successfully');
      
      // Initialize background sync service
      backgroundSyncService.initializeListeners();
      
      // Initialize periodic sync service
      await periodicSyncService.initialize();
      
      // Listen for service worker updates
      window.addEventListener('swUpdateAvailable', () => {
        console.log('[PWA] Service worker update available');
        // You can show a notification to the user here
      });
      
      // Listen for periodic sync messages
      navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data?.type === 'PERIODIC_SYNC_STATUS') {
          console.log('[PWA] Periodic sync completed:', event.data.payload);
        }
      });
      
    } else {
      console.warn('[PWA] Service worker registration failed:', result.error?.message);
    }
    
  } catch (error) {
    console.error('[PWA] PWA initialization error:', error);
    mobileErrorHandler.handleError({
      type: 'unknown',
      message: `PWA initialization failed: ${error}`
    });
  }
};

// Initialize systems
const initializeApp = async () => {
  try {
    console.log('[App] Starting initialization sequence...');
    
    // Initialize Capacitor first for native platforms
    await initializeCapacitor();
    
    // Initialize font system
    await initializeFontSystem();
    
    // Initialize viewport fix
    fixViewportHeight();
    
    // Initialize mobile optimizations early
    await mobileOptimizationService.initialize();
    
    // Initialize native integration service for mobile features
    await nativeIntegrationService.initialize();
    
    // Initialize PWA features
    await initializePWA();
    
    // Manage splash screen after everything is initialized
    await manageSplashScreen();
    
    // Detect iOS and set a class on the HTML element
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      document.documentElement.classList.add('ios-device');
    }
    
    // Detect Android and set a class
    if (/Android/.test(navigator.userAgent)) {
      document.documentElement.classList.add('android-device');
    }
    
    // Detect if running in Capacitor native app
    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add('capacitor-native');
      console.log('[App] Running in Capacitor native environment');
    }
    
    console.log('[App] Initialization complete');
  } catch (error) {
    console.error('[App] Initialization failed:', error);
    mobileErrorHandler.handleError({
      type: 'crash',
      message: `App initialization failed: ${error}`
    });
  }
};

// Start initialization
initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ContextReadinessProvider>
        <ThemeProvider>
          <TranslationProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </TranslationProvider>
        </ThemeProvider>
      </ContextReadinessProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
