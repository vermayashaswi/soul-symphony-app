
import React from "react";

// Create a provider for backward compatibility
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Create a null hook for backward compatibility that supports both addLog and addEvent
export const useChatDebug = () => ({
  logs: [],
  addLog: (category?: string, message?: string, level?: string, details?: any) => {},
  addEvent: (category?: string, message?: string, level?: string, details?: any) => {}, // Added with parameters
  clearLogs: () => {},
  isEnabled: true, // Always enabled now
  toggleEnabled: () => {}
});

// Export the panel component for backward compatibility
const DebugPanel = () => null;
export default DebugPanel;
