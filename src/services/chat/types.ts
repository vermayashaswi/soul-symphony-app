
import { Json } from "@/integrations/supabase/types";

// Types for chat persistence
export type ChatThread = {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
  reference_entries?: Json[];
  analysis_data?: {
    analysis?: string;
    requiresSql?: boolean;
    sqlQuery?: string;
    [key: string]: any;
  };
  has_numeric_result?: boolean;
  role: 'user' | 'assistant' | 'error';
};

// Add a theme notification type for more structured event handling
export type ThemeUpdateEvent = {
  entryId: number;
  timestamp: number;
  source?: string;
};
