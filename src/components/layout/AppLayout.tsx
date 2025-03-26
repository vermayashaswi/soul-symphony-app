
import React, { useEffect } from "react";
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
  
  useEffect(() => {
    // Using logInfo instead of directly calling addLog to prevent infinite loops
    logInfo(`AppLayout rendered for path: ${location.pathname}`, {
      isAuthPage,
      pathname: location.pathname,
      search: location.search
    });
  }, [location.pathname, location.search, isAuthPage, logInfo]);
  
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
