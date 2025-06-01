
// Font loading utility for ensuring proper font display in 3D text
export interface FontLoadingState {
  isLoaded: boolean;
  hasError: boolean;
  fontFamily: string;
}

// Check if a font is loaded and available
export const checkFontLoaded = (fontFamily: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!document.fonts) {
      // Fallback for browsers without FontFace API
      console.warn('FontFace API not supported, assuming font is loaded');
      resolve(true);
      return;
    }

    // Check if font is already loaded
    if (document.fonts.check(`16px "${fontFamily}"`)) {
      resolve(true);
      return;
    }

    // Wait for font to load
    document.fonts.ready.then(() => {
      const isLoaded = document.fonts.check(`16px "${fontFamily}"`);
      console.log(`Font ${fontFamily} loaded:`, isLoaded);
      resolve(isLoaded);
    }).catch(() => {
      console.warn(`Error loading font ${fontFamily}`);
      resolve(false);
    });
  });
};

// Get the appropriate font for a given script
export const getFontForScript = (text: string): string => {
  if (!text) return 'Inter';
  
  // Devanagari script detection
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
    return 'Noto Sans CJK';
  }
  
  // Default to Inter for Latin scripts
  return 'Inter';
};

// Preload fonts for better performance
export const preloadFont = (fontFamily: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!document.fonts) {
      resolve();
      return;
    }

    const fontFace = new FontFace(fontFamily, `url(https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}&display=swap)`);
    
    fontFace.load().then(() => {
      document.fonts.add(fontFace);
      console.log(`Successfully preloaded font: ${fontFamily}`);
      resolve();
    }).catch((error) => {
      console.warn(`Failed to preload font ${fontFamily}:`, error);
      reject(error);
    });
  });
};

// Initialize font loading for commonly used scripts
export const initializeFonts = async (): Promise<void> => {
  const fonts = [
    'Noto Sans Devanagari',
    'Inter'
  ];

  const loadPromises = fonts.map(font => 
    preloadFont(font).catch(error => 
      console.warn(`Font loading failed for ${font}:`, error)
    )
  );

  await Promise.allSettled(loadPromises);
  console.log('Font initialization completed');
};
