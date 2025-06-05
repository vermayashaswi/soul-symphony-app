
import React from 'react';
import { Link } from 'react-router-dom';
import SouloLogo from '@/components/SouloLogo';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center mb-4">
              <SouloLogo size="normal" useColorTheme={false} />
            </div>
            <p className="text-gray-400 mb-6 max-w-md">
              Express. Reflect. Grow. Your personal AI-powered voice journaling companion for emotional wellness and self-discovery.
            </p>
            <div className="flex space-x-4">
              <a href="https://twitter.com/soulo_online" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                Twitter
              </a>
              <a href="https://instagram.com/soulo_online" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                Instagram
              </a>
              <a href="https://linkedin.com/company/soulo" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                LinkedIn
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-gray-400 hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-gray-400 hover:text-white transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <a href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="text-gray-400 hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          {/* Download */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Download</h3>
            <ul className="space-y-2">
              <li>
                <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  App Store
                </a>
              </li>
              <li>
                <a href="https://play.google.com/store/apps/details?id=com.soulo" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                  Google Play
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400">
            © 2024 SOULo. All rights reserved. Made with ❤️ for mental wellness.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
