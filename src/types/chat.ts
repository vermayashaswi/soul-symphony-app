
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
  idempotency_key?: string | null; // For preventing duplicate messages
  isInteractive?: boolean;
  interactiveOptions?: InteractiveOption[];
  references?: any[]; // Alias for reference_entries for backward compatibility
  analysis?: any; // Alias for analysis_data for backward compatibility
  hasNumericResult?: boolean; // Alias for has_numeric_result for backward compatibility
  diagnostics?: any; // For debug diagnostics
  ambiguityInfo?: AmbiguityAnalysis; // New field for ambiguity information
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
