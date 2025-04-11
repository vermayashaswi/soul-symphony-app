
// This file is now deprecated
import React from "react";

// Create a provider for backward compatibility
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Create a null hook for backward compatibility
export const useChatDebug = () => ({
  logs: [],
  addLog: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Export the panel component for backward compatibility
const DebugPanel = () => null;
export default DebugPanel;
