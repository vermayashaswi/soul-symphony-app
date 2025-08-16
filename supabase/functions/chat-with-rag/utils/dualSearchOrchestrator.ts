
// Enhanced dual search orchestrator with proper vector search integration
import { searchWithStrategy } from './searchService.ts';
import { OptimizedApiClient } from './optimizedApiClient.ts';

export class DualSearchOrchestrator {
  
  static async executeParallelSearch(
    supabase: any,
    userId: string,
    queryEmbedding: number[],
    queryPlan: any,
    message: string
  ): Promise<{ vectorResults: any[], sqlResults: any[], combinedResults: any[] }> {
    console.log('[DualSearchOrchestrator] Executing parallel vector and SQL search');
    console.log(`[DualSearchOrchestrator] Query embedding dimensions: ${queryEmbedding?.length || 'none'}`);
    
    try {
      // Validate embedding
      if (!OptimizedApiClient.validateEmbedding(queryEmbedding)) {
        console.error('[DualSearchOrchestrator] Invalid embedding provided, falling back to SQL-only search');
        const sqlResults = await this.executeSQLBasedSearch(supabase, userId, queryPlan, message);
        return {
          vectorResults: [],
          sqlResults,
          combinedResults: sqlResults
        };
      }

      // Execute both searches in parallel
      const [vectorResults, sqlResults] = await Promise.all([
        // Vector search with proper embedding
        this.executeVectorSearch(supabase, userId, queryEmbedding, queryPlan),
        // SQL-based search (theme/entity focused)
        this.executeSQLBasedSearch(supabase, userId, queryPlan, message)
      ]);

      // Combine and deduplicate results
      const combinedResults = this.combineAndDeduplicateResults(vectorResults, sqlResults);
      
      console.log(`[DualSearchOrchestrator] Parallel search completed: ${vectorResults.length} vector, ${sqlResults.length} SQL, ${combinedResults.length} combined`);
      
      return {
        vectorResults,
        sqlResults,
        combinedResults
      };
    } catch (error) {
      console.error('[DualSearchOrchestrator] Error in parallel search:', error);
      // Fallback to SQL-only search
      try {
        const sqlResults = await this.executeSQLBasedSearch(supabase, userId, queryPlan, message);
        return {
          vectorResults: [],
          sqlResults,
          combinedResults: sqlResults
        };
      } catch (fallbackError) {
        console.error('[DualSearchOrchestrator] Fallback SQL search also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  static async executeSequentialSearch(
    supabase: any,
    userId: string,
    queryEmbedding: number[],
    queryPlan: any,
    message: string
  ): Promise<{ vectorResults: any[], sqlResults: any[], combinedResults: any[] }> {
    console.log('[DualSearchOrchestrator] Executing sequential vector then SQL search');
    
    try {
      // Execute vector search first
      let vectorResults: any[] = [];
      if (OptimizedApiClient.validateEmbedding(queryEmbedding)) {
        vectorResults = await this.executeVectorSearch(supabase, userId, queryEmbedding, queryPlan);
      } else {
        console.warn('[DualSearchOrchestrator] Invalid embedding, skipping vector search');
      }

      // Execute SQL search with vector results context
      const sqlResults = await this.executeSQLBasedSearch(
        supabase,
        userId,
        queryPlan,
        message,
        vectorResults
      );

      // Combine results
      const combinedResults = this.combineAndDeduplicateResults(vectorResults, sqlResults);
      
      console.log(`[DualSearchOrchestrator] Sequential search completed: ${vectorResults.length} vector, ${sqlResults.length} SQL, ${combinedResults.length} combined`);
      
      return {
        vectorResults,
        sqlResults,
        combinedResults
      };
    } catch (error) {
      console.error('[DualSearchOrchestrator] Error in sequential search:', error);
      throw error;
    }
  }

  private static async executeVectorSearch(
    supabase: any,
    userId: string,
    queryEmbedding: number[],
    queryPlan: any
  ): Promise<any[]> {
    try {
      console.log('[DualSearchOrchestrator] Executing vector search');
      
      // Use the enhanced search service with proper vector strategy
      const results = await searchWithStrategy(
        supabase,
        userId,
        queryEmbedding,
        'vector',
        queryPlan.filters?.timeRange,
        queryPlan.filters?.themes,
        queryPlan.filters?.entities,
        queryPlan.filters?.emotions,
        20 // Increased limit for vector search
      );

      console.log(`[DualSearchOrchestrator] Vector search found ${results.length} entries`);
      
      // Add search method metadata
      return results.map(result => ({
        ...result,
        searchMethod: 'vector',
        searchScore: result.similarity || 0
      }));
      
    } catch (error) {
      console.error('[DualSearchOrchestrator] Error in vector search:', error);
      return [];
    }
  }

  private static async executeSQLBasedSearch(
    supabase: any,
    userId: string,
    queryPlan: any,
    message: string,
    vectorContext?: any[]
  ): Promise<any[]> {
    try {
      console.log('[DualSearchOrchestrator] Executing SQL-based search');
      
      // Determine best SQL search strategy based on query plan
      let sqlStrategy = 'hybrid';
      
      if (queryPlan.filters?.themes && queryPlan.filters.themes.length > 0) {
        sqlStrategy = 'theme_focused';
      } else if (queryPlan.filters?.entities && queryPlan.filters.entities.length > 0) {
        sqlStrategy = 'entity_focused';
      } else if (queryPlan.filters?.emotions && queryPlan.filters.emotions.length > 0 && 
                 queryPlan.filters?.entities && queryPlan.filters.entities.length > 0) {
        sqlStrategy = 'entity_emotion_analysis';
      }

      console.log(`[DualSearchOrchestrator] Using SQL strategy: ${sqlStrategy}`);

      // Use a dummy embedding for SQL-focused searches (won't be used in pure SQL functions)
      const dummyEmbedding = new Array(1536).fill(0);
      
      const results = await searchWithStrategy(
        supabase,
        userId,
        dummyEmbedding,
        sqlStrategy as any,
        queryPlan.filters?.timeRange,
        queryPlan.filters?.themes,
        queryPlan.filters?.entities,
        queryPlan.filters?.emotions,
        15
      );

      console.log(`[DualSearchOrchestrator] SQL search found ${results.length} entries`);
      
      // Add search method metadata
      return results.map(result => ({
        ...result,
        searchMethod: 'sql',
        searchScore: result.match_strength || result.similarity || 0
      }));

    } catch (error) {
      console.error('[DualSearchOrchestrator] Error in SQL-based search:', error);
      return [];
    }
  }

  private static combineAndDeduplicateResults(vectorResults: any[], sqlResults: any[]): any[] {
    const seenIds = new Set<string>();
    const combined: any[] = [];

    // Add vector results first (they typically have better semantic relevance)
    vectorResults.forEach(result => {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        combined.push({
          ...result,
          searchMethod: 'vector',
          searchPriority: 1
        });
      }
    });

    // Add SQL results that weren't already included
    sqlResults.forEach(result => {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        combined.push({
          ...result,
          searchMethod: 'sql',
          searchPriority: 2
        });
      }
    });

    // Sort by search priority and relevance score
    combined.sort((a, b) => {
      // First priority: search method (vector first)
      if (a.searchPriority !== b.searchPriority) {
        return a.searchPriority - b.searchPriority;
      }
      
      // Second priority: relevance score
      const scoreA = a.similarity || a.match_strength || a.searchScore || 0;
      const scoreB = b.similarity || b.match_strength || b.searchScore || 0;
      return scoreB - scoreA;
    });

    console.log(`[DualSearchOrchestrator] Combined ${vectorResults.length} vector + ${sqlResults.length} SQL = ${combined.length} unique results`);
    
    return combined;
  }

  static shouldUseParallelExecution(queryPlan: any): boolean {
    // Use parallel execution for complex queries or when time is critical
    return queryPlan.complexity === 'complex' || 
           queryPlan.expectedResponseType === 'analysis' ||
           queryPlan.strategy === 'comprehensive' ||
           queryPlan.embeddingNeeded === true;
  }
}
