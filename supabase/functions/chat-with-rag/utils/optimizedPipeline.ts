import { OptimizedApiClient } from './optimizedApiClient.ts';
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
      userProfile = {}
    } = requestData;

    const timerId = PerformanceOptimizer.startTimer('unified_rag_pipeline');

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

      // Step 2: GPT Query Planning - Required, no fallbacks
      await this.streamManager.sendEvent('progress', { 
        stage: 'gpt_planning', 
        message: 'Calling GPT query planner...' 
      });

      const { data: queryPlan, error: planError } = await this.supabaseClient.functions.invoke('smart-query-planner', {
        body: { 
          userMessage: message, 
          conversationContext,
          userProfile 
        }
      });
      
      if (planError || !queryPlan) {
        throw new Error(`GPT query planner failed: ${planError?.message || 'No plan returned'}`);
      }

      // Step 3: Generate embedding
      await this.streamManager.sendEvent('progress', { 
        stage: 'embedding', 
        message: 'Generating query embedding...' 
      });

      const queryEmbedding = await OptimizedApiClient.getEmbedding(message, this.openaiApiKey);

      // Step 4: Execute Enhanced RAG Orchestrator
      await this.streamManager.sendEvent('progress', { 
        stage: 'enhanced_orchestrator', 
        message: 'Executing enhanced RAG orchestration...',
        data: { strategy: queryPlan.strategy }
      });

      const { data: orchestrationResult, error: orchestrationError } = await this.supabaseClient.functions.invoke('enhanced-rag-orchestrator', {
        body: {
          userMessage: message,
          threadId: 'streaming',
          conversationContext,
          userProfile,
          queryPlan,
          queryEmbedding
        }
      });

      if (orchestrationError || !orchestrationResult) {
        throw new Error(`Enhanced RAG orchestrator failed: ${orchestrationError?.message || 'No result returned'}`);
      }

      const { 
        subQuestions = [], 
        queryPlans = [], 
        searchResults = [], 
        finalResponse: aiResponse,
        metadata = {}
      } = orchestrationResult;

      // Step 5: Prepare final response
      const finalResponse = {
        response: aiResponse,
        analysis: {
          queryPlan,
          subQuestions,
          queryPlans,
          searchMethod: 'enhanced_rag_orchestrator',
          resultsBreakdown: {
            totalResults: searchResults.length,
            subQuestions: subQuestions.length,
            orchestrated: true
          },
          isAnalyticalQuery: queryPlan.expectedResponse === 'analysis',
          processingTime: PerformanceOptimizer.endTimer(timerId, 'unified_rag_pipeline'),
          gptDriven: true,
          unifiedPipeline: true,
          metadata
        },
        referenceEntries: searchResults.slice(0, 8).map(entry => ({
          id: entry.id,
          content: entry.content?.slice(0, 200) || 'No content',
          created_at: entry.created_at,
          themes: entry.themes || [],
          emotions: entry.emotions || {},
          searchMethod: entry.searchMethod || 'orchestrated'
        }))
      };

      // Cache the result in background
      BackgroundTaskManager.getInstance().addTask(
        Promise.resolve(SmartCache.set(cacheKey, finalResponse, 300))
      );

      await this.streamManager.sendEvent('final_response', finalResponse);
      await this.streamManager.sendEvent('complete', { fromCache: false });

    } catch (error) {
      console.error('[UnifiedPipeline] Error:', error);
      await this.streamManager.sendEvent('error', { 
        message: error.message,
        stage: 'unified_pipeline_error' 
      });
    }
  }
}