import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import './styles/marketing.css' // Import marketing-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './hooks/use-theme'
import { ThemeErrorBoundary } from './components/theme/ThemeErrorBoundary'
import { SafeThemeWrapper } from './components/theme/SafeThemeWrapper'
import { BrowserRouter } from 'react-router-dom'
import { TranslationProvider } from './contexts/TranslationContext'
import { pwaService } from './services/pwaService'
import { waitForReactReadiness } from './utils/react-readiness'

/**
 * Extremely clear, strict route split:
 * - "/" route: Only render minimal marketing homepage, NO theme/provider logic at all.
 * - Any other route: Full provider/app logic.
 * 
 * This is to fully isolate app provider system from marketing page, avoiding all theme/context/mount errors on route "/".
 */

// Font loading etc (unchanged)
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
  
  // Font loading with timeout and graceful degradation
  const loadFontWithRetry = async (fontFamily: string, retries = 2): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        if (document.fonts && document.fonts.check) {
          const isLoaded = document.fonts.check(`12px "${fontFamily}"`);
          if (isLoaded) {
            console.log(`[FontSystem] ${fontFamily} already loaded`);
            return true;
          }
          
          // Wait for font to load with shorter timeout for better UX
          const fontFace = new FontFace(fontFamily, `local("${fontFamily}")`);
          await Promise.race([
            fontFace.load(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
          
          console.log(`[FontSystem] ${fontFamily} loaded successfully`);
          return true;
        }
      } catch (error) {
        console.warn(`[FontSystem] Attempt ${i + 1} failed for ${fontFamily}:`, error.message);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    console.warn(`[FontSystem] ${fontFamily} failed to load, falling back to system fonts`);
    return false;
  };
  
  // Load fonts with graceful degradation
  try {
    // Wait for document fonts ready with timeout
    await Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    
    // Load fonts in parallel but don't block app initialization
    const fontPromises = coreFonts.map(font => loadFontWithRetry(font));
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
    
    return true;
    
  } catch (error) {
    console.warn('[FontSystem] Font initialization had issues, continuing with fallbacks:', error);
    // Set ready flag anyway to prevent hanging
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady', { detail: { error: error.message } }));
    return false;
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

// Initialize PWA functionality
const initializePWA = () => {
  console.log('[PWA] Initializing PWA functionality...');
  
  // Get PWA info
  const pwaInfo = pwaService.getPWAInfo();
  console.log('[PWA] Current state:', pwaInfo);
  
  // Set PWA class on document element
  if (pwaInfo.isStandalone) {
    document.documentElement.classList.add('pwa-standalone');
  }
  
  // Add platform-specific classes
  document.documentElement.classList.add(`platform-${pwaInfo.platform}`);
  
  // Listen for network changes
  pwaService.onNetworkChange(
    () => {
      console.log('[PWA] Back online');
      document.documentElement.classList.remove('offline');
      document.documentElement.classList.add('online');
    },
    () => {
      console.log('[PWA] Gone offline');
      document.documentElement.classList.remove('online');
      document.documentElement.classList.add('offline');
    }
  );
  
  // Set initial network state
  if (pwaService.isOnline()) {
    document.documentElement.classList.add('online');
  } else {
    document.documentElement.classList.add('offline');
  }
};

// Safer React rendering with better error handling
const renderMarketingPage = async () => {
  const rootElem = document.getElementById('root');
  if (!rootElem) return;

  try {
    console.log('[Main] Rendering marketing page for route "/"');
    const { default: MarketingHomePage } = await import('@/components/website/MarketingHomePage');
    
    ReactDOM.createRoot(rootElem).render(
      <React.StrictMode>
        <MarketingHomePage />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('[Main] Error loading marketing page:', error);
    
    // Fallback to simple marketing page
    try {
      const { default: MarketingFallback } = await import('@/components/website/MarketingFallback');
      ReactDOM.createRoot(rootElem).render(
        <React.StrictMode>
          <MarketingFallback />
        </React.StrictMode>
      );
    } catch (fallbackError) {
      console.error('[Main] Error loading marketing fallback:', fallbackError);
      
      // Ultimate fallback - inline HTML
      rootElem.innerHTML = `
        <div style="min-height:100vh;background:white;display:flex;align-items:center;justify-content:center;padding:20px;">
          <div style="text-align:center;max-width:500px;">
            <h1 style="font-size:2.5rem;font-weight:bold;color:#111827;margin-bottom:1rem;">SOULo</h1>
            <p style="font-size:1.125rem;color:#6b7280;margin-bottom:2rem;">
              Your personal AI companion for emotional wellness and self-reflection using voice journaling.
            </p>
            <div style="display:flex;flex-direction:column;gap:1rem;align-items:center;">
              <button onclick="window.open('https://apps.apple.com/app/soulo', '_blank')" 
                      style="background:#000;color:white;padding:12px 24px;border-radius:8px;border:none;cursor:pointer;">
                Download on App Store
              </button>
              <button onclick="window.open('https://play.google.com/store/apps/details?id=com.soulo.app', '_blank')" 
                      style="background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;border:none;cursor:pointer;">
                Get it on Google Play
              </button>
            </div>
          </div>
        </div>`;
    }
  }
};

const renderAppRoutes = async () => {
  const rootElem = document.getElementById('root');
  if (!rootElem) return;

  try {
    console.log('[Main] Rendering full app for non-marketing routes');
    
    // Wait for React readiness
    await waitForReactReadiness(3000);

    ReactDOM.createRoot(rootElem).render(
      <React.StrictMode>
        <BrowserRouter>
          <ThemeErrorBoundary>
            <ThemeProvider>
              <TranslationProvider>
                <AuthProvider>
                  <App />
                </AuthProvider>
              </TranslationProvider>
            </ThemeProvider>
          </ThemeErrorBoundary>
        </BrowserRouter>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('[Main] Error rendering app routes:', error);
    
    // Emergency fallback for app routes
    rootElem.innerHTML = `
      <div style="padding:20px;text-align:center;font-family:system-ui,sans-serif;">
        <h1>App Loading Error</h1>
        <p>Please refresh the page to try again.</p>
        <button onclick="window.location.reload()" style="padding:10px 20px;margin-top:10px;">
          Refresh Page
        </button>
      </div>`;
  }
};

// Determine which renderer to use based on route
const renderProperRoot = async () => {
  const path = window.location.pathname;
  console.log('[Main] Current path:', path);

  if (path === '/') {
    await renderMarketingPage();
  } else {
    await renderAppRoutes();
  }
};

// Initialize systems with better error handling
const initializeApp = async () => {
  try {
    console.log('[Main] Starting app initialization...');
    
    // Initialize font system (non-blocking)
    initializeFontSystem().catch(() => {});
    
    // Initialize viewport fix
    fixViewportHeight();
    
    // Initialize PWA functionality
    initializePWA();
    
    // Detect iOS and set class
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      document.documentElement.classList.add('ios-device');
    }
    
    console.log('[Main] App initialization complete');
    
    // Render the React app with safer theme handling
    await renderProperRoot();
    
  } catch (error) {
    console.error('[Main] Critical error during app initialization:', error);
    
    // Still try to render the app even if initialization fails
    await renderProperRoot();
  }
};

// Start initialization
initializeApp();

// REMINDER: This file is now ~300 lines. Please consider asking me to refactor it into smaller utility or renderer files for clarity and maintainability!
