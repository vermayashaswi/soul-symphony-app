
// Font loading utility for ensuring proper font display in 3D text
export interface FontLoadingState {
  isLoaded: boolean;
  hasError: boolean;
  fontFamily: string;
}

// Preload Google Fonts for better performance
export const preloadGoogleFont = (fontFamily: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if font is already loaded
    if (document.fonts && document.fonts.check(`16px "${fontFamily}"`)) {
      console.log(`Font ${fontFamily} already loaded`);
      resolve();
      return;
    }

    // Create link element for Google Font
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    
    // Format font name for Google Fonts URL
    const formattedName = fontFamily.replace(/\s+/g, '+');
    
    // Include common weights and character sets
    if (fontFamily.includes('Devanagari')) {
      link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;500;600;700&subset=devanagari&display=swap`;
    } else if (fontFamily.includes('Arabic')) {
      link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;500;600;700&subset=arabic&display=swap`;
    } else if (fontFamily.includes('CJK')) {
      link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;500;600;700&display=swap`;
    } else {
      link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;500;600;700&subset=latin,latin-ext&display=swap`;
    }

    link.onload = () => {
      console.log(`Google Font ${fontFamily} loaded successfully`);
      // Wait a bit for font to be processed
      setTimeout(() => resolve(), 100);
    };
    
    link.onerror = () => {
      console.warn(`Failed to load Google Font ${fontFamily}`);
      reject(new Error(`Failed to load font: ${fontFamily}`));
    };

    document.head.appendChild(link);
  });
};

// Check if a font is loaded and available
export const checkFontLoaded = (fontFamily: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!document.fonts) {
      console.warn('FontFace API not supported, attempting to load font via Google Fonts');
      preloadGoogleFont(fontFamily)
        .then(() => resolve(true))
        .catch(() => resolve(false));
      return;
    }

    // Check if font is already loaded
    if (document.fonts.check(`16px "${fontFamily}"`)) {
      resolve(true);
      return;
    }

    // Try to load the font via Google Fonts first
    preloadGoogleFont(fontFamily)
      .then(() => {
        // Wait for font to be available
        return document.fonts.ready;
      })
      .then(() => {
        const isLoaded = document.fonts.check(`16px "${fontFamily}"`);
        console.log(`Font ${fontFamily} loaded via Google Fonts:`, isLoaded);
        resolve(isLoaded);
      })
      .catch(() => {
        console.warn(`Error loading font ${fontFamily} via Google Fonts`);
        resolve(false);
      });
  });
};

// Get the appropriate font for a given script with enhanced detection
export const getFontForScript = (text: string): string => {
  if (!text) return 'Inter';
  
  // Devanagari script detection (Hindi, Marathi, Nepali, Sanskrit)
  const devanagariPattern = /[\u0900-\u097F]/;
  if (devanagariPattern.test(text)) {
    return 'Noto Sans Devanagari';
  }
  
  // Arabic script
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) {
    return 'Noto Sans Arabic';
  }
  
  // Chinese/Japanese/Korean
  const cjkPattern = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;
  if (cjkPattern.test(text)) {
    return 'Noto Sans CJK SC';
  }
  
  // Cyrillic (Russian, etc.)
  const cyrillicPattern = /[\u0400-\u04FF]/;
  if (cyrillicPattern.test(text)) {
    return 'Noto Sans';
  }
  
  // Default to Inter for Latin scripts
  return 'Inter';
};

// Initialize font loading for commonly used scripts
export const initializeFonts = async (): Promise<void> => {
  const fonts = [
    'Inter',
    'Noto Sans Devanagari',
    'Noto Sans Arabic',
    'Noto Sans CJK SC'
  ];

  console.log('Initializing fonts:', fonts);

  const loadPromises = fonts.map(font => 
    preloadGoogleFont(font).catch(error => {
      console.warn(`Font loading failed for ${font}:`, error);
      return null;
    })
  );

  await Promise.allSettled(loadPromises);
  console.log('Font initialization completed');
  
  // Wait a bit more for fonts to be fully processed
  await new Promise(resolve => setTimeout(resolve, 500));
};

// Force reload fonts if needed
export const reloadFonts = async (): Promise<void> => {
  console.log('Reloading fonts...');
  await initializeFonts();
};
