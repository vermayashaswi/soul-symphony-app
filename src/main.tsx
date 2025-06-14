import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './hooks/use-theme'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { TranslationProvider } from './contexts/TranslationContext'
import { pwaService } from './services/pwaService'
import { MarketingProviders } from './MarketingProviders'

// Helper: decide if current path is a marketing or app route
const isMarketingRoute = (pathname: string) => {
  // Only "/" and the first-level marketing pages
  return (
    pathname === "/" ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/blog") ||
    pathname.startsWith("/download") ||
    pathname.startsWith("/terms")
  );
};

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

// Initialize systems
const initializeApp = async () => {
  // Initialize font system first
  await initializeFontSystem();
  
  // Initialize viewport fix
  fixViewportHeight();
  
  // Initialize PWA functionality
  initializePWA();
  
  // Detect iOS and set a class on the HTML element
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    document.documentElement.classList.add('ios-device');
  }
  
  console.log('[App] Initialization complete');
};

// Start initialization
initializeApp();

const RootRouter: React.FC = () => {
  const location = useLocation();
  const isMarketing = isMarketingRoute(location.pathname);

  // For debugging
  // console.log("[RootRouter] Path:", location.pathname, "isMarketing:", isMarketing);

  if (isMarketing) {
    // Minimal providers for marketing – no Auth, no heavy app logic
    return (
      <MarketingProviders>
        <App /> {/* App.tsx will be marketing-safe since marketing Index/HomePage don't use Auth, etc. */}
      </MarketingProviders>
    );
  } else {
    // Full set of providers for `/app` and anything else
    return (
      <ThemeProvider>
        <TranslationProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </TranslationProvider>
      </ThemeProvider>
    );
  }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RootRouter />
    </BrowserRouter>
  </React.StrictMode>
)

// NOTE: This file is now quite long (~200+ lines). Consider refactoring it into smaller modules!
