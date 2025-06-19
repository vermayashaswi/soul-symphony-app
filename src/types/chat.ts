
import { Json } from "@/integrations/supabase/types";

export interface ChatMessage {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant' | 'error';
  role: 'user' | 'assistant' | 'error';
  created_at: string;
  reference_entries?: Json | any[] | null;
  analysis_data?: Json | any | null;
  has_numeric_result?: boolean | null;
  sub_query1?: string | null;
  sub_query2?: string | null;
  sub_query3?: string | null;
  sub_query_responses?: any[] | null;
  isInteractive?: boolean;
  interactiveOptions?: InteractiveOption[];
  references?: any[]; // Alias for reference_entries for backward compatibility
  analysis?: any; // Alias for analysis_data for backward compatibility
  hasNumericResult?: boolean; // Alias for has_numeric_result for backward compatibility
  diagnostics?: any; // For debug diagnostics
  ambiguityInfo?: AmbiguityAnalysis; // New field for ambiguity information
}

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
    intentType?: string;
    confidenceScore?: number;
    needsClarity?: boolean;
    ambiguities?: string[];
    domainContext?: string | null;
    lastUpdated?: string;
    [key: string]: any;
  };
}

export interface InteractiveOption {
  text: string;
  action: string;
  parameters?: Record<string, any>;
}

// New interface for ambiguity analysis results
export interface AmbiguityAnalysis {
  needsClarification: boolean;
  ambiguityType: 'TIME' | 'ENTITY_REFERENCE' | 'INTENT' | 'SCOPE' | 'NONE';
  reasoning: string;
  suggestedClarificationQuestions?: string[];
}
