
// Chat thread type definition
export interface ChatThread {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  processing_status?: 'idle' | 'processing' | 'failed';
  metadata?: {
    timeContext?: string | null;
    topicContext?: string | null;
    lastUpdated?: string;
    [key: string]: any;
  };
}

// Sub-query response type definition
export interface SubQueryResponse {
  message?: string;
  query?: string;
  response?: string;
  references?: any[];
  subQueries?: string[];
  subResponses?: string[];
}

// Chat message type definition
export interface ChatMessage {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant' | 'error';
  role: 'user' | 'assistant' | 'error';
  created_at: string;
  reference_entries?: any[] | null;
  references?: any[];
  analysis_data?: any | null;
  analysis?: any;
  has_numeric_result?: boolean | null;
  hasNumericResult?: boolean;
  sub_query_responses?: SubQueryResponse[] | null;
  isInteractive?: boolean;
  interactiveOptions?: any[];
  diagnostics?: any;
  is_processing?: boolean;
}

// Time analysis type definition
export interface TimeAnalysis {
  totalEntries: number;
  peakHours: Array<{hour: number, label: string, count: number}>;
  timePeriods: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
}
