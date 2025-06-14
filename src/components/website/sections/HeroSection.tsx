
import React from 'react';

interface HeroSectionProps {
  openAppStore: () => void;
  openPlayStore: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ openAppStore, openPlayStore }) => {
  console.log('HeroSection: Rendering marketing hero section');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6">
          SOULo
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-4">
          Your Voice, Your Journey
        </p>
        <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
          Transform your thoughts into insights with AI-powered voice journaling. 
          Discover patterns, track emotions, and grow through self-reflection.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button 
            onClick={openAppStore}
            className="bg-black text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-800 transition-colors shadow-lg"
          >
            Download on App Store
          </button>
          <button 
            onClick={openPlayStore}
            className="bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-600 transition-colors shadow-lg"
          >
            Get it on Google Play
          </button>
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm">
            Available for iOS and Android
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
