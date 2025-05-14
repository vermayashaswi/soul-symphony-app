
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
  sender: 'user' | 'assistant' | 'error';
  created_at: string;
  reference_entries?: Json | null;
  analysis_data?: Json | null;
  has_numeric_result?: boolean | null;
  role: 'user' | 'assistant' | 'error';
  sub_query1?: string | null;
  sub_query2?: string | null;
  sub_query3?: string | null;
  sub_query_responses?: any[] | null;
};

export type SubQueryResponse = {
  query: string;
  response: string;
  references?: any[] | Json;  // Updated to accept Json type as well
  analysis_data?: any;
};
