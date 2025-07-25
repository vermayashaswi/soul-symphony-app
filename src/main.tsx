
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { SessionProvider } from './providers/SessionProvider'
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

// Memory-optimized deferred font loading
const initializeFontSystem = async () => {
  // Check if we're in low memory situation
  const isLowMemory = (performance as any).memory && 
    (performance as any).memory.usedJSHeapSize > 50 * 1024 * 1024; // 50MB threshold
  
  if (isLowMemory) {
    console.log('[FontSystem] Low memory detected, skipping font loading');
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady', { detail: { skipped: true } }));
    return;
  }

  // Load only essential fonts
  const essentialFonts = ['Inter']; // Only load primary font
  
  try {
    // Quick check if fonts are already available
    if (document.fonts?.check?.('12px "Inter"')) {
      (window as any).__SOULO_FONTS_READY__ = true;
      window.dispatchEvent(new CustomEvent('fontsReady', { detail: { cached: true } }));
      return;
    }

    // Defer font loading to after initial render
    setTimeout(async () => {
      try {
        await Promise.race([
          document.fonts?.ready || Promise.resolve(),
          new Promise(resolve => setTimeout(resolve, 2000)) // Reduced timeout
        ]);
        
        (window as any).__SOULO_FONTS_READY__ = true;
        window.dispatchEvent(new CustomEvent('fontsReady', { 
          detail: { loadedCount: 1, totalCount: 1 } 
        }));
      } catch (error) {
        console.warn('[FontSystem] Deferred font loading failed:', error);
        (window as any).__SOULO_FONTS_READY__ = true;
        window.dispatchEvent(new CustomEvent('fontsReady', { detail: { error } }));
      }
    }, 100); // Load fonts after initial render
    
  } catch (error) {
    console.warn('[FontSystem] Font system error:', error);
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady', { detail: { error } }));
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

// Memory-optimized app initialization
const initializeApp = async () => {
  try {
    console.log('[App] Starting optimized initialization...');
    
    // Phase 1: Critical path only
    fixViewportHeight(); // Synchronous, essential for mobile
    
    // Platform detection (lightweight)
    const isAndroid = /Android/.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) document.documentElement.classList.add('ios-device');
    if (isAndroid) document.documentElement.classList.add('android-device');
    
    // Phase 2: Deferred non-critical initializations
    const deferredInit = async () => {
      try {
        // Initialize in sequence to avoid memory spikes
        await initializeFontSystem();
        await new Promise(resolve => setTimeout(resolve, 50)); // Small breathing room
        
        await mobileOptimizationService.initialize();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        await initializePWA();
        
        console.log('[App] Deferred initialization complete');
      } catch (error) {
        console.warn('[App] Deferred initialization failed:', error);
      }
    };
    
    // Start deferred initialization after a delay
    setTimeout(deferredInit, 200);
    
    console.log('[App] Critical path initialization complete');
  } catch (error) {
    console.error('[App] Critical initialization failed:', error);
    mobileErrorHandler.handleError({
      type: 'crash',
      message: `Critical app initialization failed: ${error}`
    });
  }
};

// Start initialization
initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ThemeProvider>
      <ContextReadinessProvider>
        <TranslationProvider>
          <SessionProvider enableDebug={false}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SessionProvider>
        </TranslationProvider>
      </ContextReadinessProvider>
    </ThemeProvider>
  </BrowserRouter>
)
