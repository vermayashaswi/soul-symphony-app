
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css'
import './styles/tutorial.css'

// Enhanced Font Loading System
const initializeFontSystem = async () => {
  console.log('[FontSystem] Starting font initialization...');
  
  // Core fonts that must be loaded
  const coreFonts = [
    'Inter',
    'Noto Sans'
  ];
  
  // Font loading with timeout
  const loadFontWithRetry = async (fontFamily: string): Promise<boolean> => {
    try {
      if (document.fonts && document.fonts.check) {
        const isLoaded = document.fonts.check(`12px "${fontFamily}"`);
        if (isLoaded) {
          console.log(`[FontSystem] ${fontFamily} already loaded`);
          return true;
        }
        
        // Wait for font to load with timeout
        await Promise.race([
          document.fonts.ready,
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
        
        console.log(`[FontSystem] ${fontFamily} loaded successfully`);
        return true;
      }
    } catch (error) {
      console.warn(`[FontSystem] Failed to load ${fontFamily}:`, error);
    }
    
    return false;
  };
  
  // Load core fonts
  try {
    await Promise.race([
      Promise.all(coreFonts.map(font => loadFontWithRetry(font))),
      new Promise(resolve => setTimeout(resolve, 2000))
    ]);
    
    console.log('[FontSystem] Font loading complete');
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady'));
    
  } catch (error) {
    console.error('[FontSystem] Font initialization error:', error);
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady', { detail: { error } }));
  }
};

// iOS Viewport Height Fix
const fixViewportHeight = () => {
  const setVhProperty = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  setVhProperty();
  window.addEventListener('resize', setVhProperty);
  window.addEventListener('orientationchange', () => {
    setTimeout(setVhProperty, 100);
  });
  
  // iOS keyboard handling
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    document.documentElement.classList.add('ios-device');
  }
};

// Initialize systems
const initializeApp = async () => {
  console.log('[App] Starting initialization...');
  
  try {
    // Initialize core systems
    await initializeFontSystem();
    fixViewportHeight();
    
    console.log('[App] Initialization complete');
  } catch (error) {
    console.error('[App] Initialization error:', error);
  }
};

// Start initialization
initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
