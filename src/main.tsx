
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './hooks/use-theme'
import { BrowserRouter } from 'react-router-dom'
import { TranslationProvider } from './contexts/TranslationContext'

// Enhanced Font Loading System with better error handling
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
  const loadFontWithRetry = async (fontFamily: string, retries = 2): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        if (document.fonts && document.fonts.check) {
          const isLoaded = document.fonts.check(`12px "${fontFamily}"`);
          if (isLoaded) {
            console.log(`[FontSystem] ${fontFamily} already loaded`);
            return true;
          }
          
          // Wait for font to load with shorter timeout to prevent hanging
          const fontFace = new FontFace(fontFamily, `local("${fontFamily}")`);
          await Promise.race([
            fontFace.load(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)) // Reduced timeout
          ]);
          
          console.log(`[FontSystem] ${fontFamily} loaded successfully`);
          return true;
        }
      } catch (error) {
        console.warn(`[FontSystem] Attempt ${i + 1} failed for ${fontFamily}:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Shorter retry delay
        }
      }
    }
    
    console.warn(`[FontSystem] Failed to load ${fontFamily} after ${retries} attempts, continuing anyway`);
    return false;
  };
  
  try {
    // Wait for document fonts ready with shorter timeout
    await Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 3000)) // Reduced timeout
    ]);
    
    // Load core fonts with reduced attempts to prevent hanging
    const fontPromises = coreFonts.map(font => loadFontWithRetry(font, 2));
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
    try {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    } catch (error) {
      console.warn('[ViewportFix] Error setting viewport height:', error);
    }
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

// Initialize systems with better error handling
const initializeApp = async () => {
  try {
    console.log('[Main] Starting application initialization');
    
    // Initialize viewport fix first
    fixViewportHeight();
    
    // Detect iOS and set a class on the HTML element
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      document.documentElement.classList.add('ios-device');
    }
    
    // Initialize font system with timeout to prevent hanging
    const fontTimeout = new Promise((resolve) => {
      setTimeout(() => {
        console.log('[Main] Font loading timeout reached, continuing with app initialization');
        resolve(true);
      }, 5000); // Maximum 5 seconds for font loading
    });
    
    await Promise.race([
      initializeFontSystem(),
      fontTimeout
    ]);
    
    console.log('[Main] Application initialization complete');
    
  } catch (error) {
    console.error('[Main] Error during app initialization:', error);
    // Continue with app initialization even if there are errors
  }
};

// Start initialization but don't wait for it to complete
initializeApp();

// Render the app immediately to prevent loading delays
console.log('[Main] Starting React app render');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <TranslationProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </TranslationProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
