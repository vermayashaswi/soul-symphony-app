
import React from "react";

const MarketingFooter = () => (
  <footer className="bg-gray-50 border-t border-gray-100 py-10">
    <div className="container mx-auto px-4 text-center text-gray-500">
      <div className="mb-6 flex justify-center gap-8 text-sm">
        <a href="/privacy-policy" className="hover:text-primary">Privacy Policy</a>
        <a href="#features" className="hover:text-primary">Features</a>
        <a href="#download" className="hover:text-primary">Download</a>
      </div>
      <p className="text-xs">
        &copy; {new Date().getFullYear()} SOULo. All rights reserved.
      </p>
      <div className="mt-3 text-xs">
        Not for emergency use. If you're in crisis, please seek professional help or dial a local helpline.
      </div>
    </div>
  </footer>
);

export default MarketingFooter;
