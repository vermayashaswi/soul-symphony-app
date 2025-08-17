
/**
 * Fallback mechanisms for failed SQL queries
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export interface FallbackResult {
  success: boolean;
  data: any[];
  method: 'sql' | 'vector' | 'simple';
  errorMessage?: string;
}

/**
 * Execute query with automatic fallback to vector search
 */
export async function executeWithFallback(
  supabaseClient: any,
  userId: string,
  originalQuery: string,
  queryEmbedding?: number[]
): Promise<FallbackResult> {
  
  try {
    // Try SQL query first
    console.log('[Fallback] Attempting SQL query...');
    const { data: sqlData, error: sqlError } = await supabaseClient.rpc('execute_dynamic_query', {
      query_text: originalQuery
    });
    
    if (!sqlError && sqlData?.success) {
      return {
        success: true,
        data: sqlData.data || [],
        method: 'sql'
      };
    }
    
    console.log('[Fallback] SQL failed, falling back to vector search...', sqlError?.message);
    
    // Fallback to vector search
    if (queryEmbedding) {
      const { data: vectorData, error: vectorError } = await supabaseClient.rpc('match_journal_entries', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 10,
        user_id_filter: userId
      });
      
      if (!vectorError && vectorData) {
        return {
          success: true,
          data: vectorData,
          method: 'vector'
        };
      }
    }
    
    console.log('[Fallback] Vector search failed, using simple query...');
    
    // Final fallback: simple recent entries
    const { data: simpleData, error: simpleError } = await supabaseClient
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, emotions, themes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (!simpleError && simpleData) {
      return {
        success: true,
        data: simpleData,
        method: 'simple'
      };
    }
    
    return {
      success: false,
      data: [],
      method: 'simple',
      errorMessage: 'All query methods failed'
    };
    
  } catch (error) {
    console.error('[Fallback] Unexpected error:', error);
    return {
      success: false,
      data: [],
      method: 'simple',
      errorMessage: error.message
    };
  }
}
