import { OptimizedApiClient } from './optimizedApiClient.ts';
import { DualSearchOrchestrator } from './dualSearchOrchestrator.ts';
import { generateResponse, generateSystemPrompt, generateUserPrompt } from './responseGenerator.ts';
import { planQuery } from './queryPlanner.ts';
import { SSEStreamManager } from './streamingResponseManager.ts';
import { BackgroundTaskManager } from './backgroundTaskManager.ts';
import { SmartCache } from './smartCache.ts';
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
      // Step 1: Check cache first
      await this.streamManager.sendEvent('progress', { 
        stage: 'cache_check', 
        message: 'Checking cached results...' 
      });

      const cacheKey = SmartCache.generateKey(message, requestUserId, conversationContext.length);
      const cachedResult = SmartCache.get(cacheKey);

      if (cachedResult) {
        await this.streamManager.sendEvent('cache_hit', cachedResult);
        await this.streamManager.sendEvent('complete', { fromCache: true });
        return;
      }

      // Step 2: Query planning
      await this.streamManager.sendEvent('progress', { 
        stage: 'planning', 
        message: 'Analyzing query and planning search strategy...' 
      });

      const enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
      
      // Step 3: Generate embedding (parallel with planning if possible)
      await this.streamManager.sendEvent('progress', { 
        stage: 'embedding', 
        message: 'Generating query embedding...' 
      });

      const embeddingPromise = OptimizedApiClient.getEmbedding(message, this.openaiApiKey);

      // Step 4: Execute search strategy
      await this.streamManager.sendEvent('progress', { 
        stage: 'search_start', 
        message: 'Executing optimized search strategy...',
        data: { strategy: enhancedQueryPlan.strategy }
      });

      const queryEmbedding = await embeddingPromise;

      // Choose search method based on query complexity
      const searchMethod = DualSearchOrchestrator.shouldUseParallelExecution(enhancedQueryPlan) ? 
        'parallel' : 'sequential';

      let searchResults;
      if (searchMethod === 'parallel') {
        // Stream progress for parallel search
        searchResults = await this.executeParallelSearchWithStreaming(
          requestUserId, queryEmbedding, enhancedQueryPlan, message
        );
      } else {
        // Stream progress for sequential search
        searchResults = await this.executeSequentialSearchWithStreaming(
          requestUserId, queryEmbedding, enhancedQueryPlan, message
        );
      }

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
          searchMethod: `dual_${searchMethod}`,
          resultsBreakdown: {
            vector: vectorResults.length,
            sql: sqlResults.length,
            combined: combinedResults.length
          },
          isAnalyticalQuery,
          processingTime: PerformanceOptimizer.endTimer(timerId, 'rag_pipeline'),
          enhancedFormatting: isAnalyticalQuery,
          dualSearchEnabled: true
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

      // Cache the result in background
      BackgroundTaskManager.getInstance().addTask(
        Promise.resolve(SmartCache.set(cacheKey, finalResponse, 300))
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
}