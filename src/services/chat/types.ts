
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
    intentType?: string;
    confidenceScore?: number;
    needsClarity?: boolean;
    ambiguities?: string[];
    domainContext?: string | null;
    lastUpdated?: string;
    [key: string]: any;
  };
}

// MessageResponse type for sendMessage function
export interface MessageResponse {
  response: string;
  status: string;
  messageId?: string;
  error?: string;
}

// Sub-query response type definition
export interface SubQueryResponse {
  query: string;
  response: string;
  references?: any[];
}

// Chat message type definition - this is the main ServiceChatMessage export
export interface ChatMessage {
  id: string;
  thread_id: string;
  content: string;
  sender: 'user' | 'assistant' | 'error';
  role: 'user' | 'assistant' | 'error';  // Make this required to match types/chat.ts
  created_at: string;
  reference_entries?: any[];
  references?: any[];
  analysis_data?: any;
  analysis?: any;
  has_numeric_result?: boolean;
  hasNumericResult?: boolean;
  sub_query_responses?: SubQueryResponse[];
  isInteractive?: boolean;
  interactiveOptions?: any[];
  diagnostics?: any;
  is_processing?: boolean;
  time_pattern_analysis?: any; // Add this field for time pattern analysis results
}

// Export ServiceChatMessage as an alias for ChatMessage
export type ServiceChatMessage = ChatMessage;

// Type guard to check if an object has thread metadata
export function isThreadMetadata(obj: any): obj is ChatThread['metadata'] {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
}

// Type guard to check if an object matches the SubQueryResponse interface
export function isSubQueryResponse(value: any): value is SubQueryResponse {
  return typeof value === 'object' && value !== null && 
         typeof value.query === 'string' && 
         typeof value.response === 'string';
}

// Convert SubQueryResponse array to Json-compatible format
export function subQueryResponseToJson(responses: SubQueryResponse[]): any[] {
  if (!responses || !Array.isArray(responses)) return [];
  
  return responses.map(response => ({
    query: response.query,
    response: response.response,
    references: response.references || []
  }));
}

// Convert Json to SubQueryResponse array
export function jsonToSubQueryResponse(json: any): SubQueryResponse[] {
  if (!json) return [];
  if (!Array.isArray(json)) {
    try {
      json = JSON.parse(json);
      if (!Array.isArray(json)) return [];
    } catch {
      return [];
    }
  }
  
  return json
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      query: typeof item.query === 'string' ? item.query : '',
      response: typeof item.response === 'string' ? item.response : '',
      references: Array.isArray(item.references) ? item.references : []
    }));
}
