
import React from "react";

// Create a provider for backward compatibility but it will render nothing
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Create a null hook for backward compatibility 
export const useChatDebug = () => ({
  logs: [],
  addLog: () => {},
  addEvent: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Export an empty component for backward compatibility
const DebugPanel = () => null;
export default DebugPanel;
