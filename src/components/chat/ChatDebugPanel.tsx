
// This file is now deprecated, we'll redirect to our new debug log panel
import { useDebugLog } from "@/utils/debug/DebugContext";
import DebugLogPanel from "@/components/debug/DebugLogPanel";

// Create a provider for backward compatibility
export const ChatDebugProvider = ({ children }: { children: React.ReactNode }) => {
  return children;
};

// Create a hook for backward compatibility
export const useChatDebug = useDebugLog;

// Export the panel component for backward compatibility
export default DebugLogPanel;
