
import { searchEntriesWithVector, searchEntriesWithTimeRange } from './searchService.ts';

export class DualSearchOrchestrator {
  /**
   * Execute vector and SQL search in parallel for maximum performance
   */
  static async executeParallelSearch(
    supabase: any,
    userId: string,
    queryEmbedding: number[],
    queryPlan: any,
    message: string
  ): Promise<any> {
    console.log('[DualSearch] Starting parallel search execution');
    
    try {
      const [vectorResults, sqlResults] = await Promise.all([
        // Vector search
        this.executeVectorSearch(supabase, userId, queryEmbedding, queryPlan),
        // SQL-based search
        this.executeSqlSearch(supabase, userId, message, queryPlan)
      ]);

      const combinedResults = this.combineAndDeduplicateResults(vectorResults, sqlResults);
      
      console.log(`[DualSearch] Parallel search completed: ${vectorResults.length} vector + ${sqlResults.length} SQL = ${combinedResults.length} total`);
      
      return {
        vectorResults,
        sqlResults,
        combinedResults,
        searchMethod: 'dual_parallel'
      };
    } catch (error) {
      console.error('[DualSearch] Parallel search failed:', error);
      // Fallback to vector-only search
      const fallbackResults = await this.executeVectorSearch(supabase, userId, queryEmbedding, queryPlan);
      return {
        vectorResults: fallbackResults,
        sqlResults: [],
        combinedResults: fallbackResults,
        searchMethod: 'dual_parallel_fallback'
      };
    }
  }

  /**
   * Execute vector and SQL search sequentially
   */
  static async executeSequentialSearch(
    supabase: any,
    userId: string,
    queryEmbedding: number[],
    queryPlan: any,
    message: string
  ): Promise<any> {
    console.log('[DualSearch] Starting sequential search execution');
    
    try {
      // Execute vector search first
      const vectorResults = await this.executeVectorSearch(supabase, userId, queryEmbedding, queryPlan);
      
      // Then execute SQL search
      const sqlResults = await this.executeSqlSearch(supabase, userId, message, queryPlan);
      
      const combinedResults = this.combineAndDeduplicateResults(vectorResults, sqlResults);
      
      console.log(`[DualSearch] Sequential search completed: ${vectorResults.length} vector + ${sqlResults.length} SQL = ${combinedResults.length} total`);
      
      return {
        vectorResults,
        sqlResults,
        combinedResults,
        searchMethod: 'dual_sequential'
      };
    } catch (error) {
      console.error('[DualSearch] Sequential search failed:', error);
      // Fallback to vector-only search
      const fallbackResults = await this.executeVectorSearch(supabase, userId, queryEmbedding, queryPlan);
      return {
        vectorResults: fallbackResults,
        sqlResults: [],
        combinedResults: fallbackResults,
        searchMethod: 'dual_sequential_fallback'
      };
    }
  }

  /**
   * Execute vector similarity search using the correct function signature
   */
  private static async executeVectorSearch(
    supabase: any,
    userId: string,
    queryEmbedding: number[],
    queryPlan: any
  ): Promise<any[]> {
    try {
      if (queryPlan.requiresTimeFilter && queryPlan.timeRange) {
        console.log('[DualSearch] Executing time-filtered vector search');
        return await searchEntriesWithTimeRange(
          supabase,
          userId,
          queryEmbedding,
          queryPlan.timeRange
        );
      } else {
        console.log('[DualSearch] Executing standard vector search');
        return await searchEntriesWithVector(supabase, userId, queryEmbedding);
      }
    } catch (error) {
      console.error('[DualSearch] Vector search error:', error);
      return [];
    }
  }

  /**
   * Execute SQL-based search using theme, entity, and emotion matching
   */
  private static async executeSqlSearch(
    supabase: any,
    userId: string,
    message: string,
    queryPlan: any
  ): Promise<any[]> {
    const sqlResults: any[] = [];
    const lowerMessage = message.toLowerCase();

    try {
      // Theme-based search
      const themeKeywords = this.extractThemeKeywords(lowerMessage);
      if (themeKeywords.length > 0) {
        for (const theme of themeKeywords.slice(0, 3)) {
          try {
            const { data: themeResults, error } = await supabase.rpc(
              'match_journal_entries_by_theme',
              {
                theme_query: theme,
                user_id_filter: userId,
                match_threshold: 0.3,
                match_count: 5,
                start_date: queryPlan.timeRange?.startDate || null,
                end_date: queryPlan.timeRange?.endDate || null
              }
            );
            
            if (!error && themeResults) {
              sqlResults.push(...themeResults.map((r: any) => ({
                ...r,
                searchMethod: 'theme',
                matchedTheme: theme
              })));
            }
          } catch (error) {
            console.error(`[DualSearch] Theme search error for "${theme}":`, error);
          }
        }
      }

      // Entity-based search
      const entityKeywords = this.extractEntityKeywords(lowerMessage);
      if (entityKeywords.length > 0) {
        try {
          const { data: entityResults, error } = await supabase.rpc(
            'match_journal_entries_by_entities',
            {
              entity_queries: entityKeywords.slice(0, 3),
              user_id_filter: userId,
              match_threshold: 0.3,
              match_count: 5,
              start_date: queryPlan.timeRange?.startDate || null,
              end_date: queryPlan.timeRange?.endDate || null
            }
          );
          
          if (!error && entityResults) {
            sqlResults.push(...entityResults.map((r: any) => ({
              ...r,
              searchMethod: 'entity'
            })));
          }
        } catch (error) {
          console.error('[DualSearch] Entity search error:', error);
        }
      }

      // Emotion-based search
      const emotionKeywords = this.extractEmotionKeywords(lowerMessage);
      if (emotionKeywords.length > 0) {
        for (const emotion of emotionKeywords.slice(0, 2)) {
          try {
            const { data: emotionResults, error } = await supabase.rpc(
              'match_journal_entries_by_emotion',
              {
                emotion_name: emotion,
                user_id_filter: userId,
                min_score: 0.3,
                start_date: queryPlan.timeRange?.startDate || null,
                end_date: queryPlan.timeRange?.endDate || null,
                limit_count: 3
              }
            );
            
            if (!error && emotionResults) {
              sqlResults.push(...emotionResults.map((r: any) => ({
                ...r,
                searchMethod: 'emotion',
                matchedEmotion: emotion
              })));
            }
          } catch (error) {
            console.error(`[DualSearch] Emotion search error for "${emotion}":`, error);
          }
        }
      }

      console.log(`[DualSearch] SQL search completed with ${sqlResults.length} results`);
      return sqlResults;

    } catch (error) {
      console.error('[DualSearch] SQL search failed:', error);
      return [];
    }
  }

  /**
   * Combine and deduplicate results from vector and SQL searches
   */
  private static combineAndDeduplicateResults(vectorResults: any[], sqlResults: any[]): any[] {
    const seenIds = new Set();
    const combined: any[] = [];

    // Add vector results first (they tend to be more relevant)
    for (const result of vectorResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        combined.push({
          ...result,
          searchMethod: result.searchMethod || 'vector'
        });
      }
    }

    // Add SQL results that weren't already found
    for (const result of sqlResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        combined.push(result);
      }
    }

    // Sort by relevance (similarity score, then by date)
    return combined.sort((a, b) => {
      const aScore = a.similarity || 0;
      const bScore = b.similarity || 0;
      
      if (Math.abs(aScore - bScore) > 0.1) {
        return bScore - aScore; // Higher similarity first
      }
      
      // If similarities are close, sort by date (newer first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  /**
   * Determine if parallel execution should be used based on query complexity
   */
  static shouldUseParallelExecution(queryPlan: any): boolean {
    return (
      queryPlan.complexity === 'complex' ||
      queryPlan.complexity === 'multi_part' ||
      queryPlan.requiresAggregation ||
      queryPlan.searchStrategy === 'dual_parallel'
    );
  }

  // Helper methods for keyword extraction
  private static extractThemeKeywords(message: string): string[] {
    const themePatterns = [
      /\b(work|job|career|meeting|office|colleague|boss|project)\b/g,
      /\b(family|mom|dad|parent|child|sibling|relative|home)\b/g,
      /\b(health|doctor|medical|exercise|fitness|diet|wellness)\b/g,
      /\b(relationship|friend|love|partner|dating|marriage)\b/g,
      /\b(travel|vacation|trip|journey|adventure|explore)\b/g,
      /\b(stress|anxiety|worry|fear|concern|pressure)\b/g,
      /\b(happiness|joy|celebration|success|achievement|pride)\b/g,
      /\b(learning|education|study|course|skill|knowledge)\b/g
    ];

    const keywords = new Set<string>();
    for (const pattern of themePatterns) {
      const matches = message.match(pattern) || [];
      matches.forEach(match => keywords.add(match.toLowerCase()));
    }

    return Array.from(keywords);
  }

  private static extractEntityKeywords(message: string): string[] {
    const entityPatterns = [
      /\b(mom|dad|mother|father|parent|brother|sister|friend|colleague|boss|manager|doctor|teacher|partner|spouse|wife|husband)\b/g,
      /\b(home|office|gym|restaurant|hospital|school|university|park|beach|store|mall|workplace|clinic)\b/g
    ];

    const keywords = new Set<string>();
    for (const pattern of entityPatterns) {
      const matches = message.match(pattern) || [];
      matches.forEach(match => keywords.add(match.toLowerCase()));
    }

    return Array.from(keywords);
  }

  private static extractEmotionKeywords(message: string): string[] {
    const emotionPatterns = [
      /\b(happy|happiness|joy|excited|elated|cheerful|delighted|joyful)\b/g,
      /\b(sad|sadness|depressed|down|melancholy|grief|sorrow|upset)\b/g,
      /\b(angry|anger|mad|furious|irritated|annoyed|frustrated|rage)\b/g,
      /\b(anxious|anxiety|worried|nervous|stressed|panic|fear|fearful)\b/g,
      /\b(love|loving|affection|caring|tender|devoted|adore)\b/g,
      /\b(proud|pride|accomplished|confident|satisfied|achievement)\b/g,
      /\b(grateful|thankful|appreciation|blessed|appreciative)\b/g,
      /\b(disappointed|letdown|discouraged|dejected)\b/g,
      /\b(confused|uncertainty|bewildered|puzzled|uncertain)\b/g,
      /\b(calm|peaceful|relaxed|serene|tranquil|content)\b/g
    ];

    const keywords = new Set<string>();
    for (const pattern of emotionPatterns) {
      const matches = message.match(pattern) || [];
      matches.forEach(match => keywords.add(match.toLowerCase()));
    }

    return Array.from(keywords);
  }
}
