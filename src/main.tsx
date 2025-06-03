
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

// Initialize systems
const initializeApp = async () => {
  // Initialize viewport fix
  fixViewportHeight();
  
  // Detect iOS and set a class on the HTML element
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    document.documentElement.classList.add('ios-device');
  }
  
  // Set global font ready flag immediately
  (window as any).__SOULO_FONTS_READY__ = true;
  
  // Dispatch font ready event
  window.dispatchEvent(new CustomEvent('fontsReady', { 
    detail: { 
      loadedCount: 0, 
      totalCount: 0,
      timestamp: Date.now()
    } 
  }));
  
  console.log('[App] Initialization complete');
};

// Start initialization
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
