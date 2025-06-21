
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import { TranslationProvider } from './contexts/TranslationContext'
import { ThemeProvider } from './hooks/use-theme'
import { initializeServiceWorker } from './utils/serviceWorker'
import { backgroundSyncService } from './services/backgroundSyncService'
import { periodicSyncService } from './services/periodicSyncService'

// Simplified viewport height fix for iOS
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

// Simple PWA initialization
const initializePWA = async () => {
  try {
    const result = await initializeServiceWorker();
    
    if (result.success) {
      backgroundSyncService.initializeListeners();
      await periodicSyncService.initialize();
    }
  } catch (error) {
    console.warn('[PWA] Initialization failed:', error);
    // Non-critical error, continue app initialization
  }
};

// Initialize basic systems
const initializeApp = () => {
  fixViewportHeight();
  
  // Initialize PWA features asynchronously without blocking React
  initializePWA();
  
  // Set global font ready flag to prevent hanging
  (window as any).__SOULO_FONTS_READY__ = true;
  window.dispatchEvent(new CustomEvent('fontsReady', { 
    detail: { timestamp: Date.now() } 
  }));
};

// Start basic initialization before React renders
initializeApp();

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
