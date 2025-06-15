
import React from "react";
import MarketingSouloLogo from "@/components/marketing/MarketingSouloLogo";

const MarketingNavbar = () => (
  <nav className="sticky top-0 bg-white border-b border-gray-100 w-full z-30 py-3">
    <div className="container mx-auto flex justify-between items-center px-4">
      <a href="/" className="flex items-center gap-2">
        <MarketingSouloLogo size="normal" />
        <span className="text-xl font-bold tracking-tight text-blue-600">SOULo</span>
      </a>
      <div className="hidden sm:flex gap-8 font-medium items-center">
        <a href="#features" className="hover:text-blue-600 transition-colors">Product</a>
        <a href="#privacy" className="hover:text-blue-600 transition-colors">Privacy</a>
        <a href="#download" className="hover:text-blue-600 transition-colors">Download</a>
      </div>
      <div className="sm:hidden">
        {/* Minimal mobile navigation toggle: unimplemented, can be added if needed */}
      </div>
    </div>
  </nav>
);

export default MarketingNavbar;
