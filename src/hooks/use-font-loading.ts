
import { useState, useEffect } from 'react';

/**
 * Custom hook to detect font loading status
 * Particularly useful for handling complex scripts like Devanagari
 */
export const useFontLoading = () => {
  const [fontStatus, setFontStatus] = useState({
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
      document.fonts.addEventListener('loadingdone', () => {
        const devanagariReady = document.fonts.check('16px "Noto Sans Devanagari"');
        setFontStatus(prev => ({
          ...prev,
          fontsLoaded: true,
          devanagariReady
        }));
      });
      
      document.fonts.addEventListener('loadingerror', () => {
        setFontStatus(prev => ({
          ...prev,
          fontsLoaded: true,
          fontsError: true
        }));
      });
    } else {
      // Fallback for browsers that don't support document.fonts
      setTimeout(() => {
        setFontStatus({
          fontsLoaded: true,
          fontsError: false,
          devanagariReady: true // Optimistically assume true if we can't check
        });
      }, 1000);
    }
  }, []);

  return fontStatus;
};

export default useFontLoading;
