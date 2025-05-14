
import { Json } from "@/integrations/supabase/types";

export interface ChatMessage {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant' | 'error';
  role: 'user' | 'assistant' | 'error';
  created_at: string;
  reference_entries?: Json | null;
  analysis_data?: Json | null;
  has_numeric_result?: boolean | null;
  sub_query1?: string | null;
  sub_query2?: string | null;
  sub_query3?: string | null;
  sub_query_responses?: any[] | null;
  isInteractive?: boolean;
  interactiveOptions?: {
    text: string;
    action: string;
    parameters?: Record<string, any>;
  }[];
}

export interface InteractiveOption {
  text: string;
  action: string;
  parameters?: Record<string, any>;
}
