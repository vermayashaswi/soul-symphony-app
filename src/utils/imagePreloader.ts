
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
    '/lovable-uploads/e3578093-b94f-4002-82ad-c56fb4c32915.png', // Eye avatar for Ruh
  ];

  try {
    await Promise.all(criticalImages.map(src => preloadImage(src)));
    console.log('Critical images preloaded successfully');
  } catch (error) {
    console.warn('Some images failed to preload:', error);
  }
};
