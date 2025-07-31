import React, { ReactNode } from 'react';

/**
 * Marketing Context Provider - Only includes contexts needed for marketing pages
 * This provider excludes authentication-dependent contexts to prevent errors
 */
export const MarketingContextProvider = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {children}
    </>
  );
};