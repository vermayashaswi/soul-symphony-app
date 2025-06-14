
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">SOULo</h3>
            <p className="text-gray-600 mb-4">
              Your personal AI companion for emotional wellness and self-reflection using voice journaling.
            </p>
            <p className="text-sm text-gray-500">
              Contact us at{' '}
              <a 
                href="mailto:support@soulo.online" 
                className="text-blue-500 hover:underline"
              >
                support@soulo.online
              </a>
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
            <ul className="space-y-2 text-gray-600">
              <li>
                <a href="#features" className="hover:text-blue-500 transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-blue-500 transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#support" className="hover:text-blue-500 transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-2 text-gray-600">
              <li>
                <a href="/privacy" className="hover:text-blue-500 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-blue-500 transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-center text-gray-500 text-sm">
            © 2024 SOULo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
