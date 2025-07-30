
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

// Font preloading for 3D text rendering with timeout
export const preloadFont = (url: string, timeoutMs: number = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const loader = new XMLHttpRequest();
    loader.open('GET', url, true);
    loader.responseType = 'json';
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      loader.abort();
      reject(new Error(`Font loading timed out after ${timeoutMs}ms: ${url}`));
    }, timeoutMs);
    
    loader.onload = () => {
      clearTimeout(timeoutId);
      if (loader.status === 200) {
        resolve();
      } else {
        reject(new Error(`Failed to load font: ${url} (status: ${loader.status})`));
      }
    };
    
    loader.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error(`Network error loading font: ${url}`));
    };
    
    loader.onabort = () => {
      clearTimeout(timeoutId);
      reject(new Error(`Font loading aborted: ${url}`));
    };
    
    try {
      loader.send();
    } catch (error) {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to initiate font loading: ${url}`));
    }
  });
};

export const preloadCritical3DFonts = async (): Promise<void> => {
  const critical3DFonts = [
    'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    // Removed problematic Devanagari font URL that was causing hangs
    // 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json'
  ];

  // Load fonts with individual error handling - don't let one failure block others
  const results = await Promise.allSettled(
    critical3DFonts.map(async (url) => {
      try {
        await preloadFont(url, 3000); // 3 second timeout per font
        console.log(`Successfully preloaded font: ${url}`);
        return { url, success: true };
      } catch (error) {
        console.warn(`Failed to preload font ${url}:`, error);
        return { url, success: false, error };
      }
    })
  );

  const successful = results.filter(result => 
    result.status === 'fulfilled' && result.value.success
  ).length;
  
  console.log(`Font preloading completed: ${successful}/${critical3DFonts.length} fonts loaded successfully`);
  
  // Always resolve - don't block the UI even if fonts fail
  return Promise.resolve();
};

export const preloadCriticalImages = async (): Promise<void> => {
  const criticalImages = [
    // No critical images to preload since we're using SVG icons for avatars
  ];

  try {
    await Promise.all(criticalImages.map(src => preloadImage(src)));
    console.log('Critical images preloaded successfully');
  } catch (error) {
    console.warn('Some images failed to preload:', error);
  }
};
