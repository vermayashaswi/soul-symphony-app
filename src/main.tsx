
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import './styles/tutorial.css' // Import tutorial-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './hooks/use-theme'
import { BrowserRouter } from 'react-router-dom'

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
  
  // Enable scrolling on all content
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
  
  // Prevent iOS from doing "rubber band" scrolling at edges
  document.body.addEventListener('touchmove', function(e) {
    // Allow default scrolling in regular scrollable areas
    if (e.target && (e.target as HTMLElement).closest('.scrollable')) {
      return;
    }
    
    // Check if we've hit a boundary - if not, allow scrolling
    const scrollTop = window.scrollY;
    const scrollHeight = document.body.scrollHeight;
    const windowHeight = window.innerHeight;
    
    if ((scrollTop <= 0 && (e as any).touches[0].screenY > (e as any).touches[0].startY) ||
        (scrollTop + windowHeight >= scrollHeight && (e as any).touches[0].screenY < (e as any).touches[0].startY)) {
      // Only prevent the default if we're at a boundary and trying to scroll past it
      // This allows normal scrolling but prevents the bounce effect
      e.preventDefault();
    }
  }, { passive: false });
};

// Call the fix on page load
fixViewportHeight();

// Detect iOS and set a class on the HTML element
if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.documentElement.classList.add('ios-device');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
