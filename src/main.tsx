
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css'
import './styles/tutorial.css'
import { AuthProvider } from './contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { TranslationProvider } from './contexts/TranslationContext'
import { ContextReadinessProvider } from './contexts/ContextReadinessManager'
import { SimplifiedThemeProvider } from './hooks/use-simplified-theme'
import { initializeServiceWorker } from './utils/serviceWorker'

// Simple font loading with timeout
const initializeFontSystem = async () => {
  console.log('[FontSystem] Starting simplified font initialization...');
  
  try {
    await Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    
    console.log('[FontSystem] Font loading complete');
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady'));
    
  } catch (error) {
    console.warn('[FontSystem] Font initialization error:', error);
    (window as any).__SOULO_FONTS_READY__ = true;
    window.dispatchEvent(new CustomEvent('fontsReady'));
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
};

// Simple PWA initialization
const initializePWA = async () => {
  try {
    console.log('[PWA] Initializing simplified service worker...');
    const result = await initializeServiceWorker();
    
    if (result.success) {
      console.log('[PWA] Service worker registered successfully');
    } else {
      console.warn('[PWA] Service worker registration failed:', result.error?.message);
    }
    
  } catch (error) {
    console.error('[PWA] PWA initialization error:', error);
  }
};

// Initialize systems
const initializeApp = async () => {
  await initializeFontSystem();
  fixViewportHeight();
  await initializePWA();
  
  // Simple iOS detection
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    document.documentElement.classList.add('ios-device');
  }
  
  console.log('[App] Simplified initialization complete');
};

// Start initialization
initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ContextReadinessProvider>
        <SimplifiedThemeProvider>
          <TranslationProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </TranslationProvider>
        </SimplifiedThemeProvider>
      </ContextReadinessProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
