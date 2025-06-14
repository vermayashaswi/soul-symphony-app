
import React from 'react';

const Navbar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-200 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">SOULo</h1>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-gray-600 hover:text-blue-500 transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-blue-500 transition-colors">
              Pricing
            </a>
            <a href="#support" className="text-gray-600 hover:text-blue-500 transition-colors">
              Support
            </a>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.open('https://apps.apple.com/app/soulo', '_blank')}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Download App
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
