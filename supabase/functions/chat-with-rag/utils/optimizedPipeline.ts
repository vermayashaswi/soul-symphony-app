import { OptimizedApiClient } from './optimizedApiClient.ts';
import { DualSearchOrchestrator } from './dualSearchOrchestrator.ts';
import { generateResponse, generateSystemPrompt, generateUserPrompt } from './responseGenerator.ts';
import { planQuery } from './queryPlanner.ts';
import { SSEStreamManager } from './streamingResponseManager.ts';
import { BackgroundTaskManager } from './backgroundTaskManager.ts';
import { SmartCache } from './smartCache.ts';
import { EnhancedCache } from './enhancedCache.ts';
import { ConnectionPoolManager } from './connectionPool.ts';
import { PerformanceOptimizer } from './performanceOptimizer.ts';

export class OptimizedRagPipeline {
  private streamManager: SSEStreamManager;
  private supabaseClient: any;
  private openaiApiKey: string;

  constructor(streamManager: SSEStreamManager, supabaseClient: any, openaiApiKey: string) {
    this.streamManager = streamManager;
    this.supabaseClient = supabaseClient;
    this.openaiApiKey = openaiApiKey;
  }

  async processQuery(requestData: any): Promise<void> {
    const { 
      message, 
      userId: requestUserId, 
      conversationContext = [], 
      userProfile = {},
      queryPlan = null
    } = requestData;

    const timerId = PerformanceOptimizer.startTimer('rag_pipeline');

    try {
      // Phase 1: Smart Fast-Track Routing
      const fastTrackResult = await this.checkFastTrackEligibility(message);
      if (fastTrackResult.eligible) {
        await this.streamManager.sendEvent('progress', {
          stage: 'fast_track',
          message: 'Using optimized fast-track response...'
        });
        
        const directResponse = await this.generateDirectResponse(message, fastTrackResult.type, requestUserId);
        await this.streamManager.sendEvent('final_response', directResponse);
        await this.streamManager.sendEvent('complete', { fastTrack: true });
        return;
      }

      // Step 1: Check enhanced cache first
      await this.streamManager.sendEvent('progress', { 
        stage: 'cache_check', 
        message: 'Checking intelligent cache...' 
      });

      // Phase 3: Enhanced caching with intelligent TTL
      const cacheKey = EnhancedCache.generateIntelligentKey(
        message, requestUserId, conversationContext.length, enhancedQueryPlan?.complexity?.level
      );
      const cachedResult = EnhancedCache.get(cacheKey);

      if (cachedResult) {
        await this.streamManager.sendEvent('cache_hit', cachedResult);
        await this.streamManager.sendEvent('complete', { fromCache: true });
        return;
      }

      // Step 2: Enhanced query planning with progress feedback
      await this.streamManager.sendEvent('progress', { 
        stage: 'planning', 
        message: 'Analyzing query complexity and optimizing strategy...' 
      });

      const enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
      
      // Send detailed planning result
      await this.streamManager.sendEvent('progress', {
        stage: 'planning_complete',
        message: `Strategy: ${enhancedQueryPlan.strategy} | Complexity: ${enhancedQueryPlan.complexity?.level || 'standard'}`,
        data: { 
          strategy: enhancedQueryPlan.strategy, 
          complexity: enhancedQueryPlan.complexity,
          optimizationLevel: 'enhanced'
        }
      });
      
      // Step 3: Generate embedding with better feedback
      await this.streamManager.sendEvent('progress', { 
        stage: 'embedding', 
        message: 'Generating semantic embedding for optimal search...' 
      });

      const embeddingPromise = OptimizedApiClient.getEmbedding(message, this.openaiApiKey);

      // Step 4: Execute parallel search by default (Phase 1 optimization)
      await this.streamManager.sendEvent('progress', { 
        stage: 'search_start', 
        message: 'Executing parallel vector + SQL search for maximum speed...',
        data: { 
          strategy: enhancedQueryPlan.strategy,
          searchMethod: 'parallel',
          optimization: 'dual_search_enabled'
        }
      });

      const queryEmbedding = await embeddingPromise;

      // Force parallel search for better performance (Phase 1)
      const searchResults = await this.executeParallelSearchWithStreaming(
        requestUserId, queryEmbedding, enhancedQueryPlan, message
      );

      const { vectorResults, sqlResults, combinedResults } = searchResults;

      // Step 5: Generate response with streaming
      await this.streamManager.sendEvent('progress', { 
        stage: 'response_generation', 
        message: 'Generating AI response...' 
      });

      const isAnalyticalQuery = enhancedQueryPlan.expectedResponseType === 'analysis' ||
        /\b(pattern|trend|when do|what time|how often|frequency|usually|typically|statistics|insights|breakdown|analysis)\b/i.test(message);

      const systemPrompt = generateSystemPrompt(
        userProfile.timezone || 'UTC',
        enhancedQueryPlan.timeRange,
        enhancedQueryPlan.expectedResponseType,
        combinedResults.length,
        `Dual search analysis: ${vectorResults.length} vector + ${sqlResults.length} SQL results`,
        conversationContext,
        false,
        /\b(I|me|my|myself)\b/i.test(message),
        enhancedQueryPlan.requiresTimeFilter,
        'dual'
      );

      const userPrompt = generateUserPrompt(message, combinedResults, 'dual vector + SQL');

      // Generate response with potential streaming
      const aiResponse = await this.generateStreamingResponse(
        systemPrompt, userPrompt, conversationContext, isAnalyticalQuery
      );

      // Step 6: Prepare final response
      const finalResponse = {
        response: aiResponse,
        analysis: {
          queryPlan: enhancedQueryPlan,
          searchMethod: 'dual_parallel',
          resultsBreakdown: {
            vector: vectorResults.length,
            sql: sqlResults.length,
            combined: combinedResults.length
          },
          isAnalyticalQuery,
          processingTime: PerformanceOptimizer.endTimer(timerId, 'rag_pipeline'),
          enhancedFormatting: isAnalyticalQuery,
          dualSearchEnabled: true,
          optimizationLevel: 'enhanced'
        },
        referenceEntries: combinedResults.slice(0, 8).map(entry => ({
          id: entry.id,
          content: entry.content?.slice(0, 200) || 'No content',
          created_at: entry.created_at,
          themes: entry.master_themes || [],
          emotions: entry.emotions || {},
          searchMethod: entry.searchMethod || 'combined'
        }))
      };

      // Phase 3: Cache the result with enhanced strategy
      BackgroundTaskManager.getInstance().addTask(
        Promise.resolve(EnhancedCache.set(
          cacheKey, 
          finalResponse, 
          undefined, // Use intelligent TTL
          enhancedQueryPlan.complexity?.level || 'standard',
          requestUserId
        ))
      );

      await this.streamManager.sendEvent('final_response', finalResponse);
      await this.streamManager.sendEvent('complete', { fromCache: false });

    } catch (error) {
      console.error('[OptimizedPipeline] Error:', error);
      await this.streamManager.sendEvent('error', { 
        message: error.message,
        stage: 'pipeline_error' 
      });
    }
  }

  private async executeParallelSearchWithStreaming(
    userId: string, queryEmbedding: number[], queryPlan: any, message: string
  ): Promise<any> {
    await this.streamManager.sendEvent('progress', { 
      stage: 'parallel_search', 
      message: 'Executing parallel vector and SQL search...' 
    });

    const searchResults = await DualSearchOrchestrator.executeParallelSearch(
      this.supabaseClient, userId, queryEmbedding, queryPlan, message
    );

    await this.streamManager.sendEvent('search_complete', {
      method: 'parallel',
      vector_count: searchResults.vectorResults.length,
      sql_count: searchResults.sqlResults.length,
      total_count: searchResults.combinedResults.length
    });

    return searchResults;
  }

  private async executeSequentialSearchWithStreaming(
    userId: string, queryEmbedding: number[], queryPlan: any, message: string
  ): Promise<any> {
    await this.streamManager.sendEvent('progress', { 
      stage: 'vector_search', 
      message: 'Executing vector search...' 
    });

    // Note: Would need to modify DualSearchOrchestrator to support mid-process callbacks
    const searchResults = await DualSearchOrchestrator.executeSequentialSearch(
      this.supabaseClient, userId, queryEmbedding, queryPlan, message
    );

    await this.streamManager.sendEvent('search_complete', {
      method: 'sequential',
      vector_count: searchResults.vectorResults.length,
      sql_count: searchResults.sqlResults.length,
      total_count: searchResults.combinedResults.length
    });

    return searchResults;
  }

  private async generateStreamingResponse(
    systemPrompt: string, userPrompt: string, conversationContext: any[], isAnalytical: boolean
  ): Promise<string> {
    // For now, use the existing response generator
    // In a full implementation, this would stream chunks as they're generated
    return await generateResponse(
      systemPrompt, userPrompt, conversationContext, this.openaiApiKey, isAnalytical
    );
  }

  // Phase 1: Smart Fast-Track Routing Implementation
  private async checkFastTrackEligibility(message: string): Promise<{ eligible: boolean; type?: string }> {
    const lowerMessage = message.toLowerCase().trim();
    
    // Simple greeting responses
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)$/i.test(lowerMessage)) {
      return { eligible: true, type: 'greeting' };
    }
    
    // Basic status queries
    if (/^(how are you|what can you do|help)$/i.test(lowerMessage)) {
      return { eligible: true, type: 'help' };
    }
    
    // Quick motivational requests
    if (/^(motivate me|inspire me|good quote)$/i.test(lowerMessage)) {
      return { eligible: true, type: 'motivation' };
    }
    
    return { eligible: false };
  }

  private async generateDirectResponse(message: string, type: string, userId: string): Promise<any> {
    const responses = {
      greeting: "Hello! I'm here to help you explore and understand your journal entries. What would you like to know about your thoughts and experiences?",
      help: "I can help you analyze your journal entries, find patterns in your thoughts, track your emotions over time, and provide insights about your personal growth. Try asking me about your recent mood, themes in your writing, or specific memories.",
      motivation: "Remember that every entry you write is a step toward self-understanding. Your thoughts and experiences matter, and reflecting on them shows your commitment to personal growth. Keep journaling!"
    };
    
    return {
      response: responses[type] || "I'm here to help with your journal analysis.",
      analysis: {
        fastTrack: true,
        type,
        processingTime: 50, // Very fast response
        optimizationLevel: 'fast_track'
      }
    };
  }
}