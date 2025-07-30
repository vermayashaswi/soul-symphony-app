
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
};

// Font preloading for 3D text rendering
export const preloadFont = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const loader = new XMLHttpRequest();
    loader.open('GET', url, true);
    loader.responseType = 'json';
    loader.onload = () => {
      if (loader.status === 200) {
        resolve();
      } else {
        reject(new Error(`Failed to load font: ${url}`));
      }
    };
    loader.onerror = () => reject(new Error(`Failed to load font: ${url}`));
    loader.send();
  });
};

export const preloadCritical3DFonts = async (): Promise<void> => {
  const critical3DFonts = [
    'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/fonts/noto_sans_devanagari_regular.typeface.json'
  ];

  try {
    await Promise.all(critical3DFonts.map(url => preloadFont(url)));
    console.log('Critical 3D fonts preloaded successfully');
  } catch (error) {
    console.warn('Some 3D fonts failed to preload:', error);
  }
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
