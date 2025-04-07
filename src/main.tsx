
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles

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
  
  // Also update on scroll for iOS Safari
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.addEventListener('scroll', () => {
      // Debounce for performance
      if (!window.__setVhTimeout) {
        window.__setVhTimeout = setTimeout(() => {
          setVhProperty();
          window.__setVhTimeout = null;
        }, 50);
      }
    });
  }
};

// Detect if running as standalone PWA on iOS
const detectPWA = () => {
  // For iOS
  const isIOSPWA = navigator.standalone === true;
  
  // For Android Chrome
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;
  
  if (isIOSPWA || isAndroidPWA) {
    document.documentElement.classList.add('is-pwa');
    console.log('Running as PWA');
  }
};

// Call fixes on page load
fixViewportHeight();
detectPWA();

// Extend Window interface
declare global {
  interface Window {
    __setVhTimeout: any;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
