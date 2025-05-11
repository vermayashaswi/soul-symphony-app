
import React, { useEffect } from 'react';
import EnergyAnimation from '@/components/EnergyAnimation';

const BackgroundElements: React.FC = () => {
  // Preload Ruh's avatar image
  useEffect(() => {
    const preloadImage = new Image();
    preloadImage.src = '/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png';
  }, []);

  return (
    <>
      {/* Background Animation */}
      <div className="absolute inset-0 z-0">
        <EnergyAnimation fullScreen={true} bottomNavOffset={true} />
      </div>

      {/* Preload Image */}
      <div className="hidden">
        <img
          src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png"
          alt="Preload Ruh's avatar"
          width="1"
          height="1"
        />
      </div>
    </>
  );
};

export default BackgroundElements;
