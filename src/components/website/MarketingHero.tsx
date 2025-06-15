
import React from "react";
import { Apple, Play } from "lucide-react";

const openAppStore = () => {
  window.open("https://apps.apple.com/app/soulo", "_blank", "noopener");
};
const openPlayStore = () => {
  window.open("https://play.google.com/store/apps/details?id=com.soulo.app", "_blank", "noopener");
};

const MarketingHero = () => (
  <section className="w-full bg-gradient-to-br from-blue-50 to-purple-50 py-16 md:py-24 relative overflow-hidden">
    <div className="absolute inset-0 z-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/lovable-uploads/32abc730-009c-4901-912c-a16e7c2c1ec6.png')" }}></div>
    <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center gap-12">
      <div className="flex-1 text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
          Express. Reflect. Grow.
        </h1>
        <p className="text-lg md:text-2xl text-gray-700 mb-8 max-w-xl">
          Journaling should be as simple as talking. Use voice and leave the rest to us.
        </p>
        <div className="flex gap-4 mb-8 justify-center md:justify-start">
          <button
            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg text-lg hover:bg-gray-800 transition"
            onClick={openAppStore}
            aria-label="Download on the App Store"
          >
            <Apple className="w-5 h-5" />
            App Store
          </button>
          <button
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg text-lg hover:bg-primary/90 transition"
            onClick={openPlayStore}
            aria-label="Get it on Google Play"
          >
            <Play className="w-5 h-5" />
            Google Play
          </button>
        </div>
        <div className="flex gap-8 text-sm text-gray-500 justify-center md:justify-start">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M17 21V19A2 2 0 0 0 15 17H9A2 2 0 0 0 7 19V21" /><circle cx="12" cy="10" r="5" /><path d="M12 2v3" /><path d="M12 19a7 7 0 0 1-7-7" /><path d="M19 12a7 7 0 0 1-7 7" /></svg>
            Privacy-Focused
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
            14-Day Free Trial
          </div>
        </div>
      </div>
      <div className="flex-1 flex justify-center items-center relative">
        <div className="rounded-3xl shadow-xl overflow-hidden w-[300px] aspect-[9/16] bg-white border border-gray-100 relative">
          {/* Placeholder for phone animation: Replace with animation if needed */}
          <img
            src="/lovable-uploads/32abc730-009c-4901-912c-a16e7c2c1ec6.png"
            alt="SOULo App Preview"
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs shadow">Voice Journaling • AI Insights</span>
        </div>
      </div>
    </div>
  </section>
);

export default MarketingHero;
