
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
  reference_entries?: any[];
  analysis_data?: any;
  has_numeric_result?: boolean;
  role: 'user' | 'assistant';
  sub_query1?: string;
  sub_query2?: string;
  sub_query3?: string;
  sub_query_responses?: SubQueryResponse[];
};

export type SubQueryResponse = {
  query: string;
  response: string;
  references?: any[];
  analysis_data?: any;
};

