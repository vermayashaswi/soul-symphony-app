
import React from "react";
import { MarketingTranslationProvider } from './contexts/MarketingTranslationContext';

// Marketing-only providers that don't require app-level contexts
export const MarketingProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MarketingTranslationProvider>
      {children}
    </MarketingTranslationProvider>
  );
};
