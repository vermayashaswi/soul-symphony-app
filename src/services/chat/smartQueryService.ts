import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, TokenOptimizationConfig, QueryFilterParams } from "./types";
import { useToast } from "@/hooks/use-toast";

// Default optimization configuration
const DEFAULT_OPTIMIZATION_CONFIG: TokenOptimizationConfig = {
  maxEntries: 5,              // Reduced from 10
  maxEntryLength: 200,        // Truncate entries to 200 chars
  includeSentiment: true,     // Keep sentiment data
  includeEntities: false,     // Skip entities by default
  maxPreviousMessages: 5,     // Reduced from 10
  optimizationLevel: 'light' as const, // Default optimization level
  useSmartFiltering: true     // Enable smart filtering by default
};

// Gradually increase optimization based on query length
function getOptimizationConfig(queryLength: number): TokenOptimizationConfig {
  if (queryLength > 1000) {
    // Very long queries need aggressive optimization
    return {
      ...DEFAULT_OPTIMIZATION_CONFIG,
      maxEntries: 3,
      maxEntryLength: 150, 
      includeSentiment: false,
      includeEntities: false,
      maxPreviousMessages: 3,
      optimizationLevel: 'aggressive' as const,
      useSmartFiltering: true,
      filterOptions: {
        relevanceThreshold: 0.7  // Higher threshold for more aggressive filtering
      }
    };
  } else if (queryLength > 500) {
    // Medium length queries need moderate optimization
    return {
      ...DEFAULT_OPTIMIZATION_CONFIG,
      maxEntries: 4,
      maxEntryLength: 180,
      optimizationLevel: 'light' as const,
      useSmartFiltering: true
    };
  }
  
  // Default optimization for short queries
  return DEFAULT_OPTIMIZATION_CONFIG;
}

interface SmartQueryResult {
  success: boolean;
  response?: string;
  planDetails?: any;
  executionResults?: any[];
  error?: string;
  diagnostics?: any;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    contextUtilization?: number;
    filteredEntryCount?: number;
    originalEntryCount?: number;
  };
  filteringInfo?: {
    appliedFilters: string[];
    filteredCount: number;
    totalCount: number;
    filteringTime?: number;
  };
}

export async function processSmartQuery(
  message: string,
  userId: string,
  threadId: string | null = null
): Promise<SmartQueryResult> {
  try {
    console.log("[SmartQueryService] Processing query:", message.substring(0, 30) + "...");
    
    const isComplex = detectComplexQuery(message);
    const optimizationConfig = getOptimizationConfig(message.length);
    
    console.log(`[SmartQueryService] Optimization level: ${optimizationConfig.optimizationLevel}`);
    console.log(`[SmartQueryService] Smart filtering: ${optimizationConfig.useSmartFiltering ? 'enabled' : 'disabled'}`);
    
    const queryTimeout = isComplex ? 120000 : 45000; // 120s for complex, 45s for simple
    console.log(`[SmartQueryService] Query timeout set to ${queryTimeout}ms`);
    
    console.log(`[SmartQueryService] Query Complexity Analysis:
      - Message Length: ${message.length}
      - Is Complex Query: ${isComplex}
      - Timeout Duration: ${queryTimeout}ms
      - Token Optimization: ${optimizationConfig.optimizationLevel}
      - Smart Filtering: ${optimizationConfig.useSmartFiltering ? 'enabled' : 'disabled'}`);
    
    // Apply smart filtering if enabled
    let filteringInfo = null;
    if (optimizationConfig.useSmartFiltering) {
      try {
        filteringInfo = await applySmartFiltering(message, userId, optimizationConfig);
        console.log(`[SmartQueryService] Smart filtering applied:
          - Filtered entries: ${filteringInfo.filteredCount} / ${filteringInfo.totalCount}
          - Applied filters: ${filteringInfo.appliedFilters.join(', ')}
          - Processing time: ${filteringInfo.filteringTime}ms`);
      } catch (filterError) {
        console.error('[SmartQueryService] Error applying smart filtering:', filterError);
        // Continue without filtering if an error occurs
      }
    }
    
    const queryResult = await Promise.race([
      processQueryWithFallback(message, userId, threadId, isComplex, optimizationConfig, filteringInfo),
      new Promise<SmartQueryResult>((_, reject) => 
        setTimeout(() => {
          console.error('[SmartQueryService] Query processing timed out');
          reject(new Error(`Query processing timed out after ${queryTimeout}ms`));
        }, queryTimeout)
      )
    ]);

    return {
      ...queryResult,
      filteringInfo
    };
  } catch (error: any) {
    console.error('[SmartQueryService] Comprehensive error handling:', error);
    
    // Check for token limit errors specifically
    const isTokenLimitError = error.message?.includes('context length') || 
                              error.message?.includes('token') ||
                              error.message?.includes('too long');
    
    let errorMessage = error.message || 'Unexpected query processing error';
    let suggestedAction = '';
    
    if (isTokenLimitError) {
      errorMessage = 'Your query exceeds the model\'s token limit. Please try a shorter or simpler question.';
      suggestedAction = 'Break your question into smaller parts or provide less context.';
    }
    
    const errorResponse: SmartQueryResult = {
      success: false,
      error: errorMessage,
      diagnostics: {
        stage: 'query_processing',
        isComplex: detectComplexQuery(message),
        queryLength: message.length,
        fullError: error.toString(),
        timestamp: new Date().toISOString(),
        isTokenLimitError,
        suggestedAction
      }
    };
    
    return errorResponse;
  }
}

// New function to apply smart filtering
async function applySmartFiltering(
  message: string,
  userId: string,
  optimizationConfig: TokenOptimizationConfig
): Promise<any> {
  try {
    const filterStartTime = Date.now();
    
    // Extract filter options from optimization config
    const { filterOptions } = optimizationConfig;
    
    // Call the smart-query-filter edge function
    const { data, error } = await supabase.functions.invoke('smart-query-filter', {
      body: {
        userId,
        query: message,
        dateRange: filterOptions?.dateRange,
        emotions: filterOptions?.emotions,
        themes: filterOptions?.themes,
        contentKeywords: filterOptions?.contentKeywords,
        relevanceThreshold: filterOptions?.relevanceThreshold || 0.6,
        limit: optimizationConfig.maxEntries * 2 // Get more entries to have room for filtering
      }
    });
    
    if (error) {
      console.error('[SmartQueryService] Error in smart filtering:', error);
      throw error;
    }
    
    // Return filtering results
    return {
      filteredEntries: data.entries || [],
      appliedFilters: data.appliedFilters || [],
      extractedFilters: data.extractedFilters || {},
      filteredCount: data.filteredCount || 0,
      totalCount: data.totalCount || 0,
      filteringTime: Date.now() - filterStartTime
    };
  } catch (error) {
    console.error('[SmartQueryService] Failed to apply smart filtering:', error);
    throw error;
  }
}

function detectComplexQuery(message: string): boolean {
  if (!message) return false;
  
  const complexityIndicators = [
    (message.match(/\b(how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|did|am|have|has|had)\b/gi) || []).length > 1,
    (message.match(/[?!.]/g) || []).length > 1,
    message.length > 100,
    /\b(and|but|or|additionally|moreover|furthermore)\b/i.test(message)
  ];
  
  const complexityScore = complexityIndicators.filter(Boolean).length;
  
  console.log(`[SmartQueryService] Complexity Score: ${complexityScore}`);
  
  return complexityScore >= 2;
}

async function processQueryWithFallback(
  message: string, 
  userId: string, 
  threadId: string | null, 
  isComplex: boolean,
  optimizationConfig: TokenOptimizationConfig,
  filteringInfo: any = null
): Promise<SmartQueryResult> {
  try {
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId,
        optimizationConfig, // Pass optimization config to edge function
        filteredEntries: filteringInfo?.filteredEntries || null, // Pass pre-filtered entries
        metadata: {
          isComplexQuery: isComplex,
          queryLength: message.length,
          processingAttempt: 'primary',
          optimizationLevel: optimizationConfig.optimizationLevel,
          useSmartFiltering: optimizationConfig.useSmartFiltering
        }
      }
    });

    if (error) {
      console.error('[SmartQueryService] Primary query processing failed:', error);
      
      // If token limit error, try with more aggressive optimization
      if (error.message?.includes('context length') || error.message?.includes('token')) {
        console.log('[SmartQueryService] Token limit exceeded, trying with aggressive optimization');
        const aggressiveConfig: TokenOptimizationConfig = {
          ...optimizationConfig,
          maxEntries: 2,
          maxEntryLength: 100,
          includeSentiment: false,
          includeEntities: false,
          maxPreviousMessages: 2,
          optimizationLevel: 'aggressive' as const,
          useSmartFiltering: true,
          filterOptions: {
            ...optimizationConfig.filterOptions,
            relevanceThreshold: 0.8 // Even higher threshold for aggressive optimization
          }
        };
        
        return await processQueryWithAggressiveOptimization(
          message, userId, threadId, aggressiveConfig, filteringInfo
        );
      }
      
      const fallbackResult = await attemptFallbackProcessing(message, userId, threadId, filteringInfo);
      if (fallbackResult) return fallbackResult;
      
      throw error;
    }

    if (data?.error) {
      console.error('[SmartQueryService] Query processing error:', data.error);
      
      // Check if token limit error
      if (data.error.includes('context length') || data.error.includes('token')) {
        console.log('[SmartQueryService] Token limit exceeded in response, trying with aggressive optimization');
        const aggressiveConfig: TokenOptimizationConfig = {
          ...optimizationConfig,
          maxEntries: 2,
          maxEntryLength: 100,
          includeSentiment: false,
          includeEntities: false,
          maxPreviousMessages: 2,
          optimizationLevel: 'aggressive' as const,
          useSmartFiltering: true,
          filterOptions: {
            ...optimizationConfig.filterOptions,
            relevanceThreshold: 0.8
          }
        };
        
        return await processQueryWithAggressiveOptimization(
          message, userId, threadId, aggressiveConfig, filteringInfo
        );
      }
      
      const fallbackResult = await attemptFallbackProcessing(message, userId, threadId, filteringInfo);
      if (fallbackResult) return fallbackResult;
      
      throw new Error(data.error);
    }

    // Add filtering info to the token usage stats
    const tokenUsage = data.tokenUsage || {};
    if (filteringInfo) {
      tokenUsage.filteredEntryCount = filteringInfo.filteredCount;
      tokenUsage.originalEntryCount = filteringInfo.totalCount;
    }

    return {
      success: true,
      response: data.response,
      planDetails: data.planDetails,
      executionResults: data.executionResults,
      diagnostics: {
        ...data.diagnostics,
        processingMethod: 'primary',
        smartFiltering: filteringInfo ? {
          applied: true,
          filters: filteringInfo.appliedFilters,
          extractedFilters: filteringInfo.extractedFilters
        } : { applied: false }
      },
      tokenUsage,
      filteringInfo: filteringInfo ? {
        appliedFilters: filteringInfo.appliedFilters || [],
        filteredCount: filteringInfo.filteredCount || 0,
        totalCount: filteringInfo.totalCount || 0,
        filteringTime: filteringInfo.filteringTime
      } : undefined
    };
  } catch (error: any) {
    console.error('[SmartQueryService] Fallback processing error:', error);
    
    const finalFallbackResult = await attemptFinalFallback(message, userId, threadId);
    if (finalFallbackResult) return finalFallbackResult;
    
    throw error;
  }
}

async function processQueryWithAggressiveOptimization(
  message: string,
  userId: string,
  threadId: string | null,
  aggressiveConfig: TokenOptimizationConfig,
  filteringInfo: any = null
): Promise<SmartQueryResult> {
  try {
    console.log('[SmartQueryService] Attempting with aggressive token optimization');
    
    // If we already have filtering info but need aggressive optimization,
    // apply even stricter filtering
    let enhancedFilteringInfo = filteringInfo;
    if (aggressiveConfig.useSmartFiltering) {
      try {
        // Apply more aggressive filtering
        enhancedFilteringInfo = await applySmartFiltering(message, userId, aggressiveConfig);
        console.log(`[SmartQueryService] Enhanced aggressive filtering applied:
          - Filtered entries: ${enhancedFilteringInfo.filteredCount} / ${enhancedFilteringInfo.totalCount}
          - Applied filters: ${enhancedFilteringInfo.appliedFilters.join(', ')}
          - Processing time: ${enhancedFilteringInfo.filteringTime}ms`);
      } catch (filterError) {
        console.error('[SmartQueryService] Error applying enhanced filtering:', filterError);
        // Continue with original filtering if error
      }
    }
    
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId,
        optimizationConfig: aggressiveConfig,
        filteredEntries: enhancedFilteringInfo?.filteredEntries || null,
        metadata: {
          processingAttempt: 'aggressive_optimization',
          queryLength: message.length,
          optimizationLevel: 'aggressive' as const,
          useSmartFiltering: aggressiveConfig.useSmartFiltering
        }
      }
    });

    if (error || data?.error) {
      console.error('[SmartQueryService] Aggressive optimization failed:', error || data?.error);
      return await attemptFinalFallback(message, userId, threadId);
    }

    // Add filtering info to the token usage stats
    const tokenUsage = data.tokenUsage || {};
    if (enhancedFilteringInfo) {
      tokenUsage.filteredEntryCount = enhancedFilteringInfo.filteredCount;
      tokenUsage.originalEntryCount = enhancedFilteringInfo.totalCount;
    }

    return {
      success: true,
      response: data.response,
      planDetails: data.planDetails,
      executionResults: data.executionResults,
      diagnostics: {
        ...data.diagnostics,
        processingMethod: 'aggressive_optimization',
        smartFiltering: enhancedFilteringInfo ? {
          applied: true,
          filters: enhancedFilteringInfo.appliedFilters,
          extractedFilters: enhancedFilteringInfo.extractedFilters
        } : { applied: false }
      },
      tokenUsage,
      filteringInfo: enhancedFilteringInfo ? {
        appliedFilters: enhancedFilteringInfo.appliedFilters || [],
        filteredCount: enhancedFilteringInfo.filteredCount || 0,
        totalCount: enhancedFilteringInfo.totalCount || 0,
        filteringTime: enhancedFilteringInfo.filteringTime
      } : undefined
    };
  } catch (error) {
    console.error('[SmartQueryService] Aggressive optimization error:', error);
    return await attemptFinalFallback(message, userId, threadId);
  }
}

async function attemptFallbackProcessing(
  message: string, 
  userId: string, 
  threadId: string | null,
  filteringInfo: any = null
): Promise<SmartQueryResult | null> {
  try {
    console.log('[SmartQueryService] Attempting fallback processing');
    
    const { data, error } = await supabase.functions.invoke('smart-query-orchestrator', {
      body: {
        message,
        userId,
        threadId,
        filteredEntries: filteringInfo?.filteredEntries || null,
        metadata: {
          processingAttempt: 'fallback',
          queryLength: message.length,
          useSmartFiltering: filteringInfo ? true : false
        }
      }
    });

    if (error || data?.error) return null;

    // Add filtering info to the token usage stats if available
    const tokenUsage = data.tokenUsage || {};
    if (filteringInfo) {
      tokenUsage.filteredEntryCount = filteringInfo.filteredCount;
      tokenUsage.originalEntryCount = filteringInfo.totalCount;
    }

    return {
      success: true,
      response: data.response,
      planDetails: data.planDetails,
      executionResults: data.executionResults,
      diagnostics: {
        ...data.diagnostics,
        processingMethod: 'fallback',
        smartFiltering: filteringInfo ? {
          applied: true,
          filters: filteringInfo.appliedFilters
        } : { applied: false }
      },
      tokenUsage,
      filteringInfo: filteringInfo ? {
        appliedFilters: filteringInfo.appliedFilters || [],
        filteredCount: filteringInfo.filteredCount || 0,
        totalCount: filteringInfo.totalCount || 0,
        filteringTime: filteringInfo.filteringTime
      } : undefined
    };
  } catch {
    return null;
  }
}

async function attemptFinalFallback(
  message: string, 
  userId: string, 
  threadId: string | null
): Promise<SmartQueryResult | null> {
  try {
    console.log('[SmartQueryService] Attempting final fallback processing');
    
    // For very long queries, suggest breaking them down
    if (message.length > 800) {
      return {
        success: true,
        response: "I'm having trouble processing your detailed question due to token limits. Could you break it down into smaller, simpler questions? This helps me provide more accurate responses.",
        diagnostics: {
          processingMethod: 'final_fallback',
          queryLength: message.length,
          timestamp: new Date().toISOString(),
          reason: 'token_limit_exceeded'
        }
      };
    }
    
    return {
      success: true,
      response: "I'm having trouble processing your complex query. Could you rephrase it more simply or break it down into smaller questions?",
      diagnostics: {
        processingMethod: 'final_fallback',
        queryLength: message.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch {
    return null;
  }
}

// ... keep existing code (processAndSaveSmartQuery function remains the same)
