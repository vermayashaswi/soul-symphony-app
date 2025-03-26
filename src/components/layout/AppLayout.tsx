
import React, { useEffect, useCallback, useMemo } from "react";
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
  const locationData = useMemo(() => ({
    isAuthPage,
    pathname: location.pathname,
    search: location.search
  }), [location.pathname, location.search, isAuthPage]);
  
  // Log once when the path changes, not on every render
  useEffect(() => {
    // Use a non-blocking approach for logging to prevent cascading effects
    const timeoutId = setTimeout(() => {
      logInfo(`AppLayout rendered for path: ${location.pathname}`, locationData);
    }, 0);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Only depend on pathname, not the logInfo function
  
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
