
import React from "react";
import SouloLogo from "@/components/SouloLogo";

const MarketingNavbar = () => (
  <nav className="sticky top-0 bg-white border-b border-gray-100 w-full z-30 py-3">
    <div className="container mx-auto flex justify-between items-center px-4">
      <a href="/" className="flex items-center gap-2">
        <SouloLogo size="normal" useColorTheme />
        <span className="text-xl font-bold tracking-tight">SOULo</span>
      </a>
      <div className="hidden sm:flex gap-8 font-medium items-center">
        <a href="#features" className="hover:text-primary transition-colors">Product</a>
        <a href="#privacy" className="hover:text-primary transition-colors">Privacy</a>
        <a href="#download" className="hover:text-primary transition-colors">Download</a>
      </div>
      <div className="sm:hidden">
        {/* Minimal mobile navigation toggle: unimplemented, can be added if needed */}
      </div>
    </div>
  </nav>
);

export default MarketingNavbar;
