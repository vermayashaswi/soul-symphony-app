
import { MentalHealthInsights } from '@/hooks/use-mental-health-insights';

// Props for the SmartChatInterface component
export interface SmartChatInterfaceProps {
  mentalHealthInsights?: MentalHealthInsights;
  timezoneOffset: number;
  timezone?: string;
}

// Props for the MobileChatInterface component
export interface MobileChatInterfaceProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId?: string;
  mentalHealthInsights?: MentalHealthInsights;
  timezoneOffset: number;
  timezone?: string;
}
