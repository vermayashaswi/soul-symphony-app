
import React from "react";

// Create a provider for backward compatibility
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Create a null hook for backward compatibility that supports both addLog and addEvent
export const useChatDebug = () => ({
  logs: [],
  addLog: () => {},
  addEvent: () => {}, // Added this for compatibility
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Export the panel component for backward compatibility
const DebugPanel = () => null;
export default DebugPanel;
