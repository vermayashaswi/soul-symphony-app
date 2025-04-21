
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
    processingStages?: string[];
    queryComplexity?: 'simple' | 'complex' | 'multi-part';
    tokenCount?: number;  // Track token usage
    contextSize?: number; // Track context size
    optimizationLevel?: 'none' | 'light' | 'aggressive'; // Track optimization level
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

// Token optimization configuration type with enhanced filtering
export type TokenOptimizationConfig = {
  maxEntries: number;         // Maximum number of entries to include in context
  maxEntryLength: number;     // Maximum length of each entry in characters
  includeSentiment: boolean;  // Whether to include sentiment data
  includeEntities: boolean;   // Whether to include entity data
  maxPreviousMessages: number; // Maximum number of previous messages to include
  optimizationLevel: 'none' | 'light' | 'aggressive';
  // New filtering options
  useSmartFiltering: boolean; // Whether to use intelligent filtering
  filterOptions?: {
    dateRange?: {
      startDate?: string;
      endDate?: string;
    };
    emotions?: string[];      // Filter by specific emotions
    themes?: string[];        // Filter by specific themes
    relevanceThreshold?: number; // Minimum similarity score (0-1)
    contentKeywords?: string[]; // Keywords to prioritize in content
  };
};

// Data filter parameters for query optimization
export type QueryFilterParams = {
  userId: string;
  query: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  emotions?: string[];
  themes?: string[];
  relevanceThreshold?: number;
  contentKeywords?: string[];
  limit?: number;
};

