
import React from 'react';

interface ImageMap {
  [key: string]: string;
}

const imageMap: ImageMap = {
  // App Screenshots
  "appScreenshot": "/lovable-uploads/586c1ed2-eaed-4063-a18d-500e7085909d.png",
  
  // Features Images
  "features.voiceJournaling": "/lovable-uploads/f1035a0b-8b30-4d38-9234-6560a14558de.png",
  "features.aiAnalysis": "/lovable-uploads/a6374f0f-2e81-45f4-8c42-dfe81f7fbf01.png",
  "features.emotionalTracking": "/lovable-uploads/8dd08973-e7a2-4bef-a990-1e3ff0dede92.png",
  "features.aiAssistant": "/lovable-uploads/a66f2232-4b39-4d46-ace5-19e4c81b1f05.png",
  
  // Testimonial Avatars
  "testimonials.avatar1": "/lovable-uploads/69a98431-43ec-41e5-93f1-7ddaf28e2884.png",
  "testimonials.avatar2": "/lovable-uploads/5b18686b-4a3c-4341-a072-479db470ac1d.png",
  "testimonials.avatar3": "/lovable-uploads/cb710491-93f0-42be-a596-f64d80d9800e.png",
  
  // Spiritual Robot Animation
  "spiritualRobot": "https://cdn.dribbble.com/users/1068771/screenshots/14225432/media/0da8c461ba3522a6b0a0c272dd5d3b80.jpg"
};

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  width,
  height
}) => {
  // Check if the src is in our imageMap
  const imageSrc = imageMap[src] || src;
  
  return (
    <img 
      src={imageSrc} 
      alt={alt} 
      className={className} 
      width={width} 
      height={height}
      loading="lazy"
    />
  );
};
