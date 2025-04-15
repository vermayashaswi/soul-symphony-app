
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
    addLog: (...args: any[]) => {},
    addEvent: (...args: any[]) => {},
    clearLogs: (...args: any[]) => {},
    isEnabled: false,
    toggleEnabled: (...args: any[]) => {}
  };
};

export default ChatDebugPanel;
