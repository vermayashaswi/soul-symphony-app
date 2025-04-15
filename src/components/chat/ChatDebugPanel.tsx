
import React from "react";
import { useDebugLog } from "@/utils/debug/DebugContext";

// Create a provider for backward compatibility
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Create a hook that redirects to the main debug log
export const useChatDebug = () => {
  const mainDebug = useDebugLog();
  
  return {
    logs: mainDebug.logs,
    addLog: (category = 'Chat', message = '', level = 'info', details?: any) => {
      mainDebug.addEvent(category, message, level as any, details);
    },
    addEvent: (category = 'Chat', message = '', level = 'info', details?: any) => {
      mainDebug.addEvent(category, message, level as any, details);
    },
    clearLogs: mainDebug.clearLogs,
    isEnabled: mainDebug.isEnabled,
    toggleEnabled: mainDebug.toggleEnabled
  };
};

// Export the panel component for backward compatibility
const ChatDebugPanel = () => {
  return null;
};

export default ChatDebugPanel;
