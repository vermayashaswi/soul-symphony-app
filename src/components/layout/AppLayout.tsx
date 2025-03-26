
import React, { useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useDebug } from "@/contexts/debug/DebugContext";
import ErrorBoundary from "@/components/debug/ErrorBoundary";
import { useDebugLogger } from "@/hooks/use-debug-logger";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";
  const { addLog } = useDebug();
  const { logInfo } = useDebugLogger();
  
  // Memoize the location data to prevent re-renders
  const locationData = useCallback(() => ({
    isAuthPage,
    pathname: location.pathname,
    search: location.search
  }), [location.pathname, location.search, isAuthPage]);
  
  // Only run once on mount, then use locationData as a dependency
  useEffect(() => {
    // Log the initial render without causing infinite loops
    logInfo(`AppLayout rendered for path: ${location.pathname}`, locationData());
  }, [location.pathname, locationData, logInfo]);
  
  return (
    <ErrorBoundary addLog={addLog}>
      {!isAuthPage && <Navbar />}
      <div className={!isAuthPage ? "pt-16" : ""}>
        <ErrorBoundary addLog={addLog}>
          {children}
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
};

export default AppLayout;
