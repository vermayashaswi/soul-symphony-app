
import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/mobile.css' // Import mobile-specific styles
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './hooks/use-theme'
import { BrowserRouter } from 'react-router-dom'

// Enhanced font loading status tracking
const FontLoadingProvider = ({ children }: { children: React.ReactNode }) => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontsError, setFontsError] = useState(false);
  const [devanagariReady, setDevanagariReady] = useState(false);

  useEffect(() => {
    // Use existing document.fonts.ready in HTML
    if (document.documentElement.classList.contains('fonts-loaded')) {
      setFontsLoaded(true);
    }

    // Listen for the custom event from HTML
    const handleFontsLoaded = (event: any) => {
      console.log("Font loading event received:", event.detail);
      setFontsLoaded(true);
      if (event.detail?.error) {
        setFontsError(true);
      }
      if (event.detail?.devanagari) {
        setDevanagariReady(true);
      }
    };

    document.addEventListener('fontsLoaded', handleFontsLoaded);

    // Also check using document.fonts.ready
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready
        .then(() => {
          console.log("All fonts are ready according to document.fonts.ready");
          setFontsLoaded(true);
          
          // Create a test element to check if Devanagari font is actually loaded
          const testElement = document.createElement('span');
          testElement.style.fontFamily = "'Noto Sans Devanagari', 'Mukta'";
          testElement.innerHTML = 'हिन्दी';
          testElement.style.position = 'absolute';
          testElement.style.visibility = 'hidden';
          document.body.appendChild(testElement);
          
          // Check if the font is applied correctly
          setTimeout(() => {
            setDevanagariReady(true);
            document.body.removeChild(testElement);
          }, 500);
        })
        .catch(err => {
          console.warn("Error loading fonts:", err);
          setFontsLoaded(true); // Still mark as loaded to not block rendering
          setFontsError(true);
        });
    } else {
      // Fallback for browsers that don't support document.fonts
      setTimeout(() => {
        setFontsLoaded(true);
      }, 1000);
    }

    return () => {
      document.removeEventListener('fontsLoaded', handleFontsLoaded);
    };
  }, []);

  // Add font status to window for debugging
  useEffect(() => {
    // @ts-ignore
    window.fontStatus = {
      fontsLoaded,
      fontsError,
      devanagariReady
    };
  }, [fontsLoaded, fontsError, devanagariReady]);

  // Store font status in localStorage for persistence across page loads
  useEffect(() => {
    if (fontsLoaded) {
      try {
        localStorage.setItem('fonts-loaded', 'true');
        localStorage.setItem('devanagari-ready', devanagariReady ? 'true' : 'false');
      } catch (e) {
        console.warn('Failed to store font status in localStorage:', e);
      }
    }
  }, [fontsLoaded, devanagariReady]);

  // Make font status available through context
  return (
    <FontLoadingContext.Provider value={{ fontsLoaded, fontsError, devanagariReady }}>
      {children}
    </FontLoadingContext.Provider>
  );
};

// Create context for sharing font status
export const FontLoadingContext = React.createContext({
  fontsLoaded: false,
  fontsError: false, 
  devanagariReady: false
});

// Expose a hook to easily access font loading status
export const useFontLoading = () => React.useContext(FontLoadingContext);

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
      <FontLoadingProvider>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </FontLoadingProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
