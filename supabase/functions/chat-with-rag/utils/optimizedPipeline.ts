import { OptimizedApiClient } from './optimizedApiClient.ts';
import { DualSearchOrchestrator } from './dualSearchOrchestrator.ts';
import { generateResponse, generateSystemPrompt, generateUserPrompt } from './responseGenerator.ts';
import { planQuery } from './queryPlanner.ts';
import { BackgroundTaskManager } from './backgroundTaskManager.ts';
import { SmartCache } from './smartCache.ts';
import { PerformanceOptimizer } from './performanceOptimizer.ts';

export class OptimizedRagPipeline {
  private supabaseClient: any;
  private openaiApiKey: string;

  constructor(supabaseClient: any, openaiApiKey: string) {
    this.supabaseClient = supabaseClient;
    this.openaiApiKey = openaiApiKey;
  }

  async processQuerySync(requestData: any): Promise<any> {
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
      console.log('[OptimizedRagPipeline] Checking cache...');
      const cacheKey = SmartCache.generateKey(message, requestUserId, conversationContext.length);
      const cachedResult = SmartCache.get(cacheKey);

      if (cachedResult) {
        console.log('[OptimizedRagPipeline] Cache hit, returning cached result');
        return {
          ...cachedResult,
          fromCache: true
        };
      }

      // Step 2: Query planning
      console.log('[OptimizedRagPipeline] Processing query plan...');
      const enhancedQueryPlan = queryPlan || planQuery(message, userProfile.timezone);
      
      // Step 3: Generate embedding (parallel with planning if possible)
      console.log('[OptimizedRagPipeline] Generating query embedding...');
      const embeddingPromise = OptimizedApiClient.getEmbedding(message, this.openaiApiKey);

      // Step 4: Execute search strategy
      console.log('[OptimizedRagPipeline] Executing optimized search strategy...');
      const queryEmbedding = await embeddingPromise;

      // Choose search method based on query complexity
      const searchMethod = DualSearchOrchestrator.shouldUseParallelExecution(enhancedQueryPlan) ? 
        'parallel' : 'sequential';

      let searchResults;
      if (searchMethod === 'parallel') {
        searchResults = await DualSearchOrchestrator.executeParallelSearch(
          this.supabaseClient, requestUserId, queryEmbedding, enhancedQueryPlan, message
        );
      } else {
        searchResults = await DualSearchOrchestrator.executeSequentialSearch(
          this.supabaseClient, requestUserId, queryEmbedding, enhancedQueryPlan, message
        );
      }

      const { vectorResults, sqlResults, combinedResults } = searchResults;

      // Step 5: Generate response
      console.log('[OptimizedRagPipeline] Generating AI response...');
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

      // Generate response
      const aiResponse = await generateResponse(
        systemPrompt, userPrompt, conversationContext, this.openaiApiKey, isAnalyticalQuery
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
        })),
        success: true
      };

      // Cache the result in background
      BackgroundTaskManager.getInstance().addTask(
        Promise.resolve(SmartCache.set(cacheKey, finalResponse, 300))
      );

      console.log('[OptimizedRagPipeline] Response generated successfully');
      return finalResponse;

    } catch (error) {
      console.error('[OptimizedRagPipeline] Error:', error);
      throw error;
    }
  }

  // Keep the old streaming method for backwards compatibility if needed
  async processQuery(requestData: any): Promise<void> {
    // This method is deprecated but kept for compatibility
    throw new Error('Streaming mode is deprecated, use processQuerySync instead');
  }
}
