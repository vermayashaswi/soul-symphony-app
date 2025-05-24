
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
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
