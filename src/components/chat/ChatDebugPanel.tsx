
// Simple stub component that doesn't render anything
const ChatDebugPanel = () => null;

// Simple stub provider for backward compatibility
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Simple stub hook for backward compatibility
export const useChatDebug = () => {
  return {
    logs: [],
    addLog: () => {},
    addEvent: () => {},
    clearLogs: () => {},
    isEnabled: false,
    toggleEnabled: () => {}
  };
};

export default ChatDebugPanel;
