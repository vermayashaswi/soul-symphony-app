
import React from "react";

// In the future you can add e.g. a marketing-only translation, analytics, or theme provider
// For now it just provides a React Fragment to wrap children
export const MarketingProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
