
// Dual search orchestrator for combined vector and SQL search execution
import { searchWithStrategy } from './searchService.ts';
import { CacheManager } from './cacheManager.ts';
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
    
    try {
      // Execute both searches in parallel
      const [vectorResults, sqlResults] = await Promise.all([
        // Vector search
        searchWithStrategy(
          supabase,
          userId,
          queryEmbedding,
          'vector',
          queryPlan.filters?.timeRange,
          queryPlan.filters?.themes,
          queryPlan.filters?.entities,
          queryPlan.filters?.emotions,
          15
        ),
        // SQL-based search (theme/entity focused)
        this.executeSQLBasedSearch(
          supabase,
          userId,
          queryPlan,
          message
        )
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
      throw error;
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
      const vectorResults = await searchWithStrategy(
        supabase,
        userId,
        queryEmbedding,
        'vector',
        queryPlan.filters?.timeRange,
        queryPlan.filters?.themes,
        queryPlan.filters?.entities,
        queryPlan.filters?.emotions,
        15
      );

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

  private static async executeSQLBasedSearch(
    supabase: any,
    userId: string,
    queryPlan: any,
    message: string,
    vectorContext?: any[]
  ): Promise<any[]> {
    try {
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

      // Use a dummy embedding for SQL-focused searches
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

      return results;
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
          searchMethod: 'vector'
        });
      }
    });

    // Add SQL results that weren't already included
    sqlResults.forEach(result => {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        combined.push({
          ...result,
          searchMethod: 'sql'
        });
      }
    });

    // Sort by relevance (vector similarity or SQL match strength)
    combined.sort((a, b) => {
      const scoreA = a.similarity || a.match_strength || 0;
      const scoreB = b.similarity || b.match_strength || 0;
      return scoreB - scoreA;
    });

    console.log(`[DualSearchOrchestrator] Combined ${vectorResults.length} vector + ${sqlResults.length} SQL = ${combined.length} unique results`);
    
    return combined;
  }

  static shouldUseParallelExecution(queryPlan: any): boolean {
    // Use parallel execution for complex queries or when time is critical
    return queryPlan.complexity === 'complex' || 
           queryPlan.expectedResponseType === 'analysis' ||
           queryPlan.strategy === 'comprehensive';
  }
}
