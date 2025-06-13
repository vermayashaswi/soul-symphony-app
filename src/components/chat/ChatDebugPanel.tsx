
// Production-safe chat debug panel
import { createLogger } from '@/utils/logger';

const logger = createLogger('ChatDebug');

const ChatDebugPanel = () => {
  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }
  
  return null; // Minimal implementation for development
};

export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => children;

export const useChatDebug = () => ({
  logs: [],
  addLog: (...args: any[]) => {
    logger.debug('Chat log', args);
  },
  addEvent: (...args: any[]) => {
    logger.debug('Chat event', args);
  },
  clearLogs: () => {
    logger.debug('Chat logs cleared');
  },
  isEnabled: import.meta.env.DEV,
  toggleEnabled: () => {
    logger.debug('Chat debug toggled');
  },
});

export default ChatDebugPanel;
