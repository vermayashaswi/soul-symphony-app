
import React, { createContext, useContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { PropsWithChildren } from 'react';
import { TranslationProvider } from './contexts/TranslationContext';
import './i18n/i18n';

// Create a context for font loading status
type FontLoadingContextType = {
  fontsLoaded: boolean;
  fontsError: boolean;
  devanagariReady: boolean;
};

const FontLoadingContext = createContext<FontLoadingContextType>({
  fontsLoaded: false,
  fontsError: false,
  devanagariReady: false
});

// Hook to use font loading status
export const useFontLoading = () => useContext(FontLoadingContext);

// Font loading provider
const FontLoadingProvider = ({ children }: PropsWithChildren<{}>) => {
  const [fontStatus, setFontStatus] = useState<FontLoadingContextType>({
    fontsLoaded: false,
    fontsError: false,
    devanagariReady: false
  });

  useEffect(() => {
    // Use the document.fonts API to check when fonts are loaded
    if ('fonts' in document) {
      const checkFonts = async () => {
        try {
          await document.fonts.ready;
          // Check specifically for Devanagari font support
          const devanagariReady = await document.fonts.check('16px "Noto Sans Devanagari"');
          setFontStatus({
            fontsLoaded: true,
            fontsError: false,
            devanagariReady
          });
          console.log("Fonts loaded successfully. Devanagari ready:", devanagariReady);
        } catch (err) {
          console.error("Error loading fonts:", err);
          setFontStatus({
            fontsLoaded: true, // Assume fonts are loaded despite error
            fontsError: true,
            devanagariReady: false
          });
        }
      };

      checkFonts();
      
      // Also listen for loading events
      const loadingDoneHandler = () => {
        const devanagariReady = document.fonts.check('16px "Noto Sans Devanagari"');
        setFontStatus(prev => ({
          ...prev,
          fontsLoaded: true,
          devanagariReady
        }));
      };
      
      const loadingErrorHandler = () => {
        setFontStatus(prev => ({
          ...prev,
          fontsLoaded: true,
          fontsError: true
        }));
      };
      
      document.fonts.addEventListener('loadingdone', loadingDoneHandler);
      document.fonts.addEventListener('loadingerror', loadingErrorHandler);
      
      return () => {
        document.fonts.removeEventListener('loadingdone', loadingDoneHandler);
        document.fonts.removeEventListener('loadingerror', loadingErrorHandler);
      };
    } else {
      // Fallback for browsers that don't support document.fonts
      const timer = setTimeout(() => {
        setFontStatus({
          fontsLoaded: true,
          fontsError: false,
          devanagariReady: true // Optimistically assume true if we can't check
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <FontLoadingContext.Provider value={fontStatus}>
      {children}
    </FontLoadingContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <FontLoadingProvider>
      <AuthProvider>
        <ThemeProvider>
          <TranslationProvider>
            <App />
          </TranslationProvider>
        </ThemeProvider>
      </AuthProvider>
    </FontLoadingProvider>
  </React.StrictMode>
);
