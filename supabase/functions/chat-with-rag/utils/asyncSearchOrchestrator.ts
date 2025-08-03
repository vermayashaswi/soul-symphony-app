import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { OptimizedApiClient } from './optimizedApiClient.ts';

/**
 * Asynchronous Search Orchestrator for High-Performance RAG
 * Implements parallel processing, smart routing, and performance optimizations
 */
export class AsyncSearchOrchestrator {
  private supabaseClient: any;
  private openaiApiKey: string;

  constructor(supabaseClient: any, openaiApiKey: string) {
    this.supabaseClient = supabaseClient;
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Execute high-performance async search with intelligent routing
   */
  async executeAsyncSearch(
    userId: string,
    message: string,
    queryPlan: any,
    complexity: 'simple' | 'moderate' | 'complex' = 'moderate'
  ): Promise<any> {
    const startTime = Date.now();
    console.log(`[AsyncSearch] Starting ${complexity} search for: "${message}"`);

    try {
      // Parallel embedding generation and query analysis
      const [embeddingResult, enhancedQueryPlan] = await Promise.all([
        OptimizedApiClient.getEmbedding(message, this.openaiApiKey),
        this.enhanceQueryPlan(queryPlan, message, complexity)
      ]);

      console.log(`[AsyncSearch] Embedding and planning completed in ${Date.now() - startTime}ms`);

      // Route search based on complexity and confidence
      const searchResults = await this.routeSearch(
        userId,
        embeddingResult,
        enhancedQueryPlan,
        message,
        complexity
      );

      const totalTime = Date.now() - startTime;
      console.log(`[AsyncSearch] Total async search completed in ${totalTime}ms`);

      return {
        ...searchResults,
        performance: {
          totalTime,
          complexity,
          searchMethod: searchResults.searchMethod
        }
      };

    } catch (error) {
      console.error('[AsyncSearch] Error in async search:', error);
      throw error;
    }
  }

  /**
   * Intelligent search routing based on complexity and confidence
   */
  private async routeSearch(
    userId: string,
    queryEmbedding: number[],
    queryPlan: any,
    message: string,
    complexity: string
  ): Promise<any> {
    const searchConfidence = queryPlan.searchConfidence || 0.7;

    // Fast track for simple queries with high confidence
    if (complexity === 'simple' && searchConfidence > 0.85) {
      console.log('[AsyncSearch] Using fast track - vector only');
      return await this.fastTrackVectorSearch(userId, queryEmbedding, queryPlan);
    }

    // Complex queries always use comprehensive search
    if (complexity === 'complex' || searchConfidence < 0.6) {
      console.log('[AsyncSearch] Using comprehensive search - parallel SQL + vector');
      return await this.comprehensiveParallelSearch(userId, queryEmbedding, queryPlan, message);
    }

    // Standard dual search for moderate complexity
    console.log('[AsyncSearch] Using standard dual search');
    return await this.standardDualSearch(userId, queryEmbedding, queryPlan, message);
  }

  /**
   * Fast track vector search for simple queries
   */
  private async fastTrackVectorSearch(
    userId: string,
    queryEmbedding: number[],
    queryPlan: any
  ): Promise<any> {
    const startTime = Date.now();

    try {
      const { data: vectorResults, error } = await this.supabaseClient.rpc(
        'match_journal_entries',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.1,
          match_count: 8,
          user_id_filter: userId
        }
      );

      if (error) {
        console.error('[AsyncSearch] Fast track vector search error:', error);
        throw error;
      }

      const processedResults = vectorResults?.map(entry => ({
        ...entry,
        searchMethod: 'vector_fast_track',
        content: entry.content || 'No content available'
      })) || [];

      console.log(`[AsyncSearch] Fast track completed in ${Date.now() - startTime}ms with ${processedResults.length} results`);

      return {
        vectorResults: processedResults,
        sqlResults: [],
        combinedResults: processedResults,
        searchMethod: 'fast_track'
      };

    } catch (error) {
      console.error('[AsyncSearch] Fast track search failed:', error);
      throw error;
    }
  }

  /**
   * Comprehensive parallel search for complex queries
   */
  private async comprehensiveParallelSearch(
    userId: string,
    queryEmbedding: number[],
    queryPlan: any,
    message: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Execute multiple search strategies in parallel
      const searchPromises = [
        // Vector similarity search
        this.executeVectorSearch(userId, queryEmbedding, queryPlan),
        // Emotion-based search
        this.executeEmotionSearch(userId, queryPlan, message),
        // Theme-based search
        this.executeThemeSearch(userId, queryPlan, message)
      ];

      // Add temporal search if query has time references
      if (queryPlan.hasExplicitTimeReference && queryPlan.dateRange) {
        searchPromises.push(
          this.executeTemporalSearch(userId, queryEmbedding, queryPlan)
        );
      }

      const [vectorResults, emotionResults, themeResults, temporalResults] = await Promise.all(
        searchPromises
      );

      // Merge and deduplicate results
      const combinedResults = this.mergeAndDeduplicateResults([
        vectorResults,
        emotionResults,
        themeResults,
        temporalResults
      ].filter(Boolean));

      console.log(`[AsyncSearch] Comprehensive search completed in ${Date.now() - startTime}ms`);

      return {
        vectorResults: vectorResults || [],
        sqlResults: [...(emotionResults || []), ...(themeResults || [])],
        combinedResults,
        searchMethod: 'comprehensive_parallel'
      };

    } catch (error) {
      console.error('[AsyncSearch] Comprehensive search failed:', error);
      throw error;
    }
  }

  /**
   * Standard dual search for moderate complexity
   */
  private async standardDualSearch(
    userId: string,
    queryEmbedding: number[],
    queryPlan: any,
    message: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Execute vector and SQL searches in parallel
      const [vectorResults, sqlResults] = await Promise.all([
        this.executeVectorSearch(userId, queryEmbedding, queryPlan),
        this.executePrimarySQL Search(userId, queryPlan, message)
      ]);

      const combinedResults = this.mergeAndDeduplicateResults([vectorResults, sqlResults]);

      console.log(`[AsyncSearch] Standard dual search completed in ${Date.now() - startTime}ms`);

      return {
        vectorResults: vectorResults || [],
        sqlResults: sqlResults || [],
        combinedResults,
        searchMethod: 'standard_dual'
      };

    } catch (error) {
      console.error('[AsyncSearch] Standard dual search failed:', error);
      throw error;
    }
  }

  /**
   * Execute optimized vector search
   */
  private async executeVectorSearch(
    userId: string,
    queryEmbedding: number[],
    queryPlan: any
  ): Promise<any[]> {
    try {
      const functionName = queryPlan.hasExplicitTimeReference && queryPlan.dateRange
        ? 'match_journal_entries_with_date'
        : 'match_journal_entries';

      const params: any = {
        query_embedding: queryEmbedding,
        match_threshold: 0.05,
        match_count: 15,
        user_id_filter: userId
      };

      if (queryPlan.dateRange) {
        params.start_date = queryPlan.dateRange.startDate;
        params.end_date = queryPlan.dateRange.endDate;
      }

      const { data, error } = await this.supabaseClient.rpc(functionName, params);

      if (error) {
        console.error('[AsyncSearch] Vector search error:', error);
        return [];
      }

      return data?.map(entry => ({
        ...entry,
        searchMethod: 'vector',
        content: entry.content || 'No content available'
      })) || [];

    } catch (error) {
      console.error('[AsyncSearch] Vector search failed:', error);
      return [];
    }
  }

  /**
   * Execute emotion-based SQL search
   */
  private async executeEmotionSearch(
    userId: string,
    queryPlan: any,
    message: string
  ): Promise<any[]> {
    if (!queryPlan.emotionFilters || queryPlan.emotionFilters.length === 0) {
      return [];
    }

    try {
      const emotionPromises = queryPlan.emotionFilters.slice(0, 2).map(emotion => 
        this.supabaseClient.rpc('match_journal_entries_by_emotion', {
          emotion_name: emotion,
          user_id_filter: userId,
          min_score: 0.3,
          start_date: queryPlan.dateRange?.startDate || null,
          end_date: queryPlan.dateRange?.endDate || null,
          limit_count: 5
        })
      );

      const emotionResults = await Promise.all(emotionPromises);
      const flatResults = emotionResults.flatMap(result => result.data || []);

      return flatResults.map(entry => ({
        ...entry,
        searchMethod: 'emotion',
        content: entry.content || 'No content available'
      }));

    } catch (error) {
      console.error('[AsyncSearch] Emotion search failed:', error);
      return [];
    }
  }

  /**
   * Execute theme-based SQL search
   */
  private async executeThemeSearch(
    userId: string,
    queryPlan: any,
    message: string
  ): Promise<any[]> {
    if (!queryPlan.themeFilters || queryPlan.themeFilters.length === 0) {
      return [];
    }

    try {
      const themePromises = queryPlan.themeFilters.slice(0, 2).map(theme => 
        this.supabaseClient.rpc('match_journal_entries_by_theme', {
          theme_query: theme,
          user_id_filter: userId,
          match_threshold: 0.3,
          match_count: 5,
          start_date: queryPlan.dateRange?.startDate || null,
          end_date: queryPlan.dateRange?.endDate || null
        })
      );

      const themeResults = await Promise.all(themePromises);
      const flatResults = themeResults.flatMap(result => result.data || []);

      return flatResults.map(entry => ({
        ...entry,
        searchMethod: 'theme',
        content: entry.content || 'No content available'
      }));

    } catch (error) {
      console.error('[AsyncSearch] Theme search failed:', error);
      return [];
    }
  }

  /**
   * Execute primary SQL search for standard dual search
   */
  private async executePrimarySQLSearch(
    userId: string,
    queryPlan: any,
    message: string
  ): Promise<any[]> {
    try {
      if (queryPlan.emotionFilters && queryPlan.emotionFilters.length > 0) {
        return await this.executeEmotionSearch(userId, queryPlan, message);
      }

      if (queryPlan.themeFilters && queryPlan.themeFilters.length > 0) {
        return await this.executeThemeSearch(userId, queryPlan, message);
      }

      // Fallback to top emotions
      const { data, error } = await this.supabaseClient.rpc('get_top_emotions_with_entries', {
        user_id_param: userId,
        start_date: queryPlan.dateRange?.startDate || null,
        end_date: queryPlan.dateRange?.endDate || null,
        limit_count: 3
      });

      if (error) {
        console.error('[AsyncSearch] Primary SQL search error:', error);
        return [];
      }

      return data?.flatMap(emotionData => 
        emotionData.sample_entries?.map(entry => ({
          ...entry,
          searchMethod: 'sql_emotion',
          content: entry.content || 'No content available'
        })) || []
      ) || [];

    } catch (error) {
      console.error('[AsyncSearch] Primary SQL search failed:', error);
      return [];
    }
  }

  /**
   * Execute temporal search with date constraints
   */
  private async executeTemporalSearch(
    userId: string,
    queryEmbedding: number[],
    queryPlan: any
  ): Promise<any[]> {
    if (!queryPlan.dateRange) {
      return [];
    }

    try {
      const { data, error } = await this.supabaseClient.rpc('match_journal_entries_with_date', {
        query_embedding: queryEmbedding,
        match_threshold: 0.01, // Very low threshold for temporal queries
        match_count: 10,
        user_id_filter: userId,
        start_date: queryPlan.dateRange.startDate,
        end_date: queryPlan.dateRange.endDate
      });

      if (error) {
        console.error('[AsyncSearch] Temporal search error:', error);
        return [];
      }

      return data?.map(entry => ({
        ...entry,
        searchMethod: 'temporal',
        content: entry.content || 'No content available'
      })) || [];

    } catch (error) {
      console.error('[AsyncSearch] Temporal search failed:', error);
      return [];
    }
  }

  /**
   * Merge and deduplicate search results
   */
  private mergeAndDeduplicateResults(resultSets: any[][]): any[] {
    const seenIds = new Set();
    const mergedResults = [];

    for (const resultSet of resultSets) {
      for (const result of resultSet || []) {
        if (result && result.id && !seenIds.has(result.id)) {
          seenIds.add(result.id);
          mergedResults.push(result);
        }
      }
    }

    // Sort by relevance (similarity score, then recency)
    return mergedResults.sort((a, b) => {
      const scoreA = a.similarity || a.emotion_score || 0.5;
      const scoreB = b.similarity || b.emotion_score || 0.5;
      
      if (Math.abs(scoreA - scoreB) > 0.1) {
        return scoreB - scoreA; // Higher score first
      }
      
      // If scores are similar, prefer more recent
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }).slice(0, 20); // Limit to top 20 results
  }

  /**
   * Enhance query plan with additional metadata
   */
  private async enhanceQueryPlan(queryPlan: any, message: string, complexity: string): Promise<any> {
    return {
      ...queryPlan,
      enhancedComplexity: complexity,
      processingStrategy: this.determineProcessingStrategy(queryPlan, complexity),
      expectedResultCount: this.estimateResultCount(queryPlan, complexity),
      searchOptimizations: this.getSearchOptimizations(queryPlan, complexity)
    };
  }

  /**
   * Determine optimal processing strategy
   */
  private determineProcessingStrategy(queryPlan: any, complexity: string): string {
    if (complexity === 'simple' && queryPlan.searchConfidence > 0.85) {
      return 'fast_track';
    }
    
    if (complexity === 'complex' || queryPlan.searchConfidence < 0.6) {
      return 'comprehensive';
    }
    
    return 'standard';
  }

  /**
   * Estimate expected result count
   */
  private estimateResultCount(queryPlan: any, complexity: string): number {
    switch (complexity) {
      case 'simple': return 8;
      case 'complex': return 25;
      default: return 15;
    }
  }

  /**
   * Get search optimizations for the query
   */
  private getSearchOptimizations(queryPlan: any, complexity: string): string[] {
    const optimizations = [];

    if (complexity === 'simple') {
      optimizations.push('skip_theme_analysis', 'minimal_emotion_search');
    }

    if (queryPlan.hasExplicitTimeReference) {
      optimizations.push('temporal_optimization', 'date_indexed_search');
    }

    if (queryPlan.emotionFilters && queryPlan.emotionFilters.length > 0) {
      optimizations.push('emotion_targeted_search');
    }

    return optimizations;
  }
}