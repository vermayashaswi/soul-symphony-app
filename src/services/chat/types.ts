
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
  reference_entries?: Json | any[] | null;
  analysis_data?: Json | any | null;
  has_numeric_result?: boolean | null;
  role: 'user' | 'assistant' | 'error';
  sub_query1?: string | null;
  sub_query2?: string | null;
  sub_query3?: string | null;
  sub_query_responses?: any[] | null;
  isInteractive?: boolean;
  interactiveOptions?: any[];
  references?: any[]; // Alias for reference_entries
  analysis?: any; // Alias for analysis_data
  hasNumericResult?: boolean; // Alias for has_numeric_result
  diagnostics?: any; // For debug diagnostics
};

export type SubQueryResponse = {
  query: string;
  response: string;
  references?: any[] | Json;  // Updated to accept Json type as well
  analysis_data?: any;
};
