
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
  // Font is now local, no preloading needed
  console.log('Using local font, no preloading required');
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
