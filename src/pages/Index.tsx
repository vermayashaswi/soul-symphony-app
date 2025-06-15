
import React from "react";
import MarketingNavbar from "@/components/website/MarketingNavbar";
import MarketingHero from "@/components/website/MarketingHero";
import MarketingFeatures from "@/components/website/MarketingFeatures";
import MarketingPrivacy from "@/components/website/MarketingPrivacy";
import MarketingFooter from "@/components/website/MarketingFooter";

const Index = () => {
  return (
    <main className="min-h-screen flex flex-col bg-white text-neutral-900">
      <MarketingNavbar />
      <MarketingHero />
      <MarketingFeatures />
      <MarketingPrivacy />
      <MarketingFooter />
    </main>
  );
};

export default Index;
