
// Empty stub for compatibility, renders nothing and provides no debug
const ChatDebugPanel = () => null;

export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => children;

export const useChatDebug = () => ({
  logs: [],
  addLog: () => {},
  addEvent: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {},
});

export default ChatDebugPanel;
