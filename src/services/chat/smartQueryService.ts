import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, TokenOptimizationConfig, QueryFilterParams } from "./types";
import { useToast } from "@/hooks/use-toast";

// Enhanced optimization configuration with better defaults for complex queries
const DEFAULT_OPTIMIZATION_CONFIG: TokenOptimizationConfig = {
  maxEntries: 5,              
  maxEntryLength: 250,        // Increased from 200 to allow more context per entry
  includeSentiment: true,     
  includeEntities: true,      // Changed to true to capture entity mentions for complex queries
  maxPreviousMessages: 5,     
  optimizationLevel: 'light' as const,
  useSmartFiltering: true,
  filterOptions: {
    relevanceThreshold: 0.55, // Slightly reduced threshold to include more relevant context
    extractKeywords: true     // Enable keyword extraction
  }
};

// Enhanced optimization based on query complexity and length
function getOptimizationConfig(queryLength: number, isComplex = false): TokenOptimizationConfig {
  // Detect trait analysis or improvement-seeking queries
  const isTraitQuery = isComplex && queryLength > 30;
  
  if (queryLength > 1000 || isTraitQuery) {
    // Very long or complex trait queries need targeted optimization
    return {
      ...DEFAULT_OPTIMIZATION_CONFIG,
      maxEntries: 5,
      maxEntryLength: 200, 
      includeSentiment: true, // Keep sentiment for trait analysis
      includeEntities: true,  // Keep entities for trait analysis
      maxPreviousMessages: 3,
      optimizationLevel: 'medium' as const,
      useSmartFiltering: true,
      filterOptions: {
        relevanceThreshold: 0.6,  // Balance between precision and recall
        extractKeywords: true,
        prioritizeSentiment: true // Prioritize entries with clear sentiment for trait analysis
      }
    };
  } else if (queryLength > 500) {
    // Medium length queries need moderate optimization
    return {
      ...DEFAULT_OPTIMIZATION_CONFIG,
      maxEntries: 4,
      maxEntryLength: 220,
      optimizationLevel: 'light' as const,
      useSmartFiltering: true
    };
  }
  
  // Default optimization for short queries
  return DEFAULT_OPTIMIZATION_CONFIG;
}

// More robust complex query detection
function detectComplexQuery(message: string): boolean {
  if (!message) return false;
  
  const lowerMessage = message.toLowerCase();
  
  // Enhanced detection patterns for complex queries
  const complexityIndicators = [
    // Original indicators
    (message.match(/\b(how|what|why|when|where|who|which|can|could|would|should|is|are|will|do|does|did|am|have|has|had)\b/gi) || []).length > 1,
    (message.match(/[?!.]/g) || []).length > 1,
    message.length > 100,
    /\b(and|but|or|additionally|moreover|furthermore)\b/i.test(message),
    
    // New indicators for trait analysis and improvement queries
    /\b(trait|quality|characteristic|personality|improve|better|growth|develop|negative|positive)\b/i.test(lowerMessage),
    /\b(top|best|worst|main|primary|key)\b.*?\b(\d+|three|five|several)\b/i.test(lowerMessage),
    /\b(rate|score|rank|grade|evaluate|assess)\b/i.test(lowerMessage),
    /\b(out of|from|between)\b.*?\b(\d+)\b/i.test(lowerMessage),
    /\b(steps|ways|methods|strategies|techniques|tips|advice)\b.*?\b(improve|develop|grow|enhance|strengthen)\b/i.test(lowerMessage)
  ];
  
  const complexityScore = complexityIndicators.filter(Boolean).length;
  
  console.log(`[SmartQueryService] Enhanced Complexity Score: ${complexityScore}`);
  console.log(`[SmartQueryService] Detected trait analysis query: ${/\b(trait|quality|characteristic|personality)\b/i.test(lowerMessage)}`);
  
  // Consider a query complex if it scores 2+ or contains specific trait-related patterns
  return complexityScore >= 2 || 
         (/\b(trait|quality|characteristic|personality)\b/i.test(lowerMessage) && 
          /\b(improve|better|growth|develop)\b/i.test(lowerMessage));
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
    console.log("[SmartQueryService] Full query length:", message.length);
    
    const isComplex = detectComplexQuery(message);
    const optimizationConfig = getOptimizationConfig(message.length, isComplex);
    
    console.log(`[SmartQueryService] Query complexity analysis:
      - Is Complex: ${isComplex}
      - Message Length: ${message.length}
      - Contains trait keywords: ${/\b(trait|quality|characteristic|personality)\b/i.test(message.toLowerCase())}
      - Contains improvement keywords: ${/\b(improve|better|growth|develop)\b/i.test(message.toLowerCase())}
      - Contains rating keywords: ${/\b(rate|score|rank|grade)\b/i.test(message.toLowerCase())}
      - Optimization Level: ${optimizationConfig.optimizationLevel}
      - Smart Filtering: ${optimizationConfig.useSmartFiltering ? 'enabled' : 'disabled'}`);
    
    const queryTimeout = isComplex ? 150000 : 45000; // 150s for complex queries (increased from 120s)
    console.log(`[SmartQueryService] Query timeout set to ${queryTimeout}ms`);
    
    // Apply smart filtering with enhanced options for trait analysis
    let filteringInfo = null;
    if (optimizationConfig.useSmartFiltering) {
      try {
        // Extract query characteristics for better filtering
        const isTraitAnalysis = /\b(trait|quality|characteristic|personality)\b/i.test(message.toLowerCase());
        const isImprovementQuery = /\b(improve|better|growth|develop)\b/i.test(message.toLowerCase());
        const isRatingQuery = /\b(rate|score|rank|grade)\b/i.test(message.toLowerCase());
        
        const filteringOptions = {
          ...optimizationConfig.filterOptions,
          queryType: isTraitAnalysis ? 'trait_analysis' : 
                     isImprovementQuery ? 'improvement' : 
                     isRatingQuery ? 'rating' : 'general',
          expandContextForTraits: isTraitAnalysis
        };
        
        console.log(`[SmartQueryService] Enhanced filtering options:
          - Query type: ${filteringOptions.queryType}
          - Expand context: ${filteringOptions.expandContextForTraits}
          - Relevance threshold: ${filteringOptions.relevanceThreshold}`);
          
        filteringInfo = await applySmartFiltering(message, userId, optimizationConfig, filteringOptions);
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

// Enhanced smart filtering with better options for trait analysis
async function applySmartFiltering(
  message: string,
  userId: string,
  optimizationConfig: TokenOptimizationConfig,
  additionalOptions: any = {}
): Promise<any> {
  try {
    const filterStartTime = Date.now();
    
    // Extract filter options from optimization config
    const { filterOptions } = optimizationConfig;
    
    // Prepare body with enhanced options
    const filterBody = {
      userId,
      query: message,
      dateRange: filterOptions?.dateRange,
      emotions: filterOptions?.emotions,
      themes: filterOptions?.themes,
      contentKeywords: filterOptions?.contentKeywords,
      relevanceThreshold: filterOptions?.relevanceThreshold || 0.6,
      limit: optimizationConfig.maxEntries * 2, // Get more entries to have room for filtering
      queryType: additionalOptions?.queryType || 'general',
      expandContextForTraits: additionalOptions?.expandContextForTraits || false,
      prioritizeSentiment: additionalOptions?.prioritizeSentiment || 
                          filterOptions?.prioritizeSentiment || false
    };
    
    console.log("[SmartQueryService] Smart filter request options:", JSON.stringify({
      ...filterBody,
      userId: "***" // Mask the actual userId for logging
    }));
    
    // Call the smart-query-filter edge function
    const { data, error } = await supabase.functions.invoke('smart-query-filter', {
      body: filterBody
    });
    
    if (error) {
      console.error('[SmartQueryService] Error in smart filtering:', error);
      throw error;
    }
    
    console.log(`[SmartQueryService] Smart filter response stats:
      - Filtered entries: ${data.filteredCount || 0} / ${data.totalCount || 0}
      - Filters applied: ${(data.appliedFilters || []).join(', ')}`);
    
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

// ... keep existing code (for processQueryWithFallback, processQueryWithAggressiveOptimization, attemptFallbackProcessing, attemptFinalFallback)

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
        // For trait analysis queries, retain sentiment data even with aggressive optimization
        const isTraitAnalysis = /\b(trait|quality|characteristic|personality)\b/i.test(message.toLowerCase());
        
        // Adjust the aggressive config if it's a trait analysis
        if (isTraitAnalysis) {
          aggressiveConfig.includeSentiment = true;
          if (!aggressiveConfig.filterOptions) aggressiveConfig.filterOptions = {};
          aggressiveConfig.filterOptions.prioritizeSentiment = true;
          console.log('[SmartQueryService] Trait analysis detected, keeping sentiment data even with aggressive optimization');
        }
        
        // Apply more aggressive filtering
        enhancedFilteringInfo = await applySmartFiltering(message, userId, aggressiveConfig, {
          queryType: isTraitAnalysis ? 'trait_analysis' : 'general',
          expandContextForTraits: isTraitAnalysis,
          prioritizeSentiment: isTraitAnalysis
        });
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

    // Add filtering info to the token usage stats if available
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

export async function processAndSaveSmartQuery(
  message: string,
  userId: string,
  threadId: string
): Promise<{
  success: boolean;
  userMessage?: ChatMessage;
  assistantMessage?: ChatMessage;
  error?: string;
}> {
  try {
    // Process the query
    const queryResult = await processSmartQuery(message, userId, threadId);
    
    if (!queryResult.success || queryResult.error) {
      console.error('Error processing smart query:', queryResult.error);
      return {
        success: false,
        error: queryResult.error || 'Failed to process query'
      };
    }
    
    // Save user message
    const { data: userData, error: userError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: message,
        sender: 'user',
        role: 'user',
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();
      
    if (userError) {
      console.error('Error saving user message:', userError);
      return {
        success: false,
        error: `Failed to save user message: ${userError.message}`
      };
    }
    
    const userMessage: ChatMessage = userData as ChatMessage;
    
    // Save assistant message with the query result
    const { data: assistantData, error: assistantError } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: queryResult.response || 'Sorry, I couldn\'t generate a response.',
        sender: 'assistant',
        role: 'assistant',
        created_at: new Date().toISOString(),
        analysis_data: {
          tokenCount: queryResult.tokenUsage?.totalTokens,
          contextSize: queryResult.tokenUsage?.filteredEntryCount,
          optimizationLevel: queryResult.diagnostics?.processingMethod || 'primary',
          queryComplexity: queryResult.diagnostics?.isComplex ? 'complex' : 'simple',
          processingStages: queryResult.diagnostics?.stages
        }
      })
      .select('*')
      .single();
      
    if (assistantError) {
      console.error('Error saving assistant message:', assistantError);
      return {
        success: false,
        error: `Failed to save assistant message: ${assistantError.message}`,
        userMessage
      };
    }
    
    const assistantMessage: ChatMessage = assistantData as ChatMessage;
    
    // Update the thread's updated_at timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
    
    // Update the thread title if this is the first message
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', threadId);
    
    if (count === 2) { // Just created the first user and assistant messages
      // Dispatch event for thread title generation
      window.dispatchEvent(
        new CustomEvent('messageCreated', { 
          detail: { 
            threadId: threadId,
            isFirstMessage: true,
            userMessage: message
          } 
        })
      );
    }
    
    return {
      success: true,
      userMessage,
      assistantMessage
    };
  } catch (error) {
    console.error('Error in processAndSaveSmartQuery:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}
