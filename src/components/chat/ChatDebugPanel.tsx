
import React from 'react';

// Debug context type for proper typing
export interface ChatDebugContextType {
  addEvent: (category: string, message: string, level?: string) => void;
  events: any[];
}

// Create context with default no-op values
const ChatDebugContext = React.createContext<ChatDebugContextType>({
  addEvent: () => {},
  events: []
});

// Debug provider that does nothing but provides the context shape
export const ChatDebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Just return children with the context providing no-op functions
  return (
    <ChatDebugContext.Provider value={{ addEvent: () => {}, events: [] }}>
      {children}
    </ChatDebugContext.Provider>
  );
};

// Hook to use the debug context
export const useChatDebug = (): ChatDebugContextType => {
  return React.useContext(ChatDebugContext);
};

// This is a stub implementation that gets rendered only when requested
interface ChatDebugPanelProps {
  onClose?: () => void;
}

// Empty component that accepts onClose prop but doesn't use it
const ChatDebugPanel: React.FC<ChatDebugPanelProps> = ({ onClose }) => {
  return null;
};

export default ChatDebugPanel;
