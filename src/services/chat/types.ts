
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
  role: 'user' | 'assistant' | 'error';
  references?: {
    date?: string;
    snippet: string;
  }[];
  analysis?: {
    analysis: string;
    requiresSql?: boolean;
    sqlQuery?: string;
  };
};
