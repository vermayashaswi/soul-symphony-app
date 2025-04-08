
// This file is now deprecated, all debug functionality has been removed
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Create a no-op hook for backward compatibility
export const useChatDebug = () => ({
  logs: [],
  addEvent: () => {},
  clearLogs: () => {},
  isEnabled: false,
  toggleEnabled: () => {}
});

// Export an empty component for backward compatibility
export default function EmptyDebugPanel() {
  return null;
}
