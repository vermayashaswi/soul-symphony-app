
import React from 'react';

const MarketingFallback = () => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">SOULo</h1>
        <p className="text-lg text-gray-600 mb-8">
          Your personal AI companion for emotional wellness and self-reflection using voice journaling.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => window.open('https://apps.apple.com/app/soulo', '_blank')}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Download on App Store
          </button>
          <button 
            onClick={() => window.open('https://play.google.com/store/apps/details?id=com.soulo.app', '_blank')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Get it on Google Play
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-8">
          Contact us at <a href="mailto:support@soulo.online" className="text-blue-500 hover:underline">support@soulo.online</a>
        </p>
      </div>
    </div>
  );
};

export default MarketingFallback;
