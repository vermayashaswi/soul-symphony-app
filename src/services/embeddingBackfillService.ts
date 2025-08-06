import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EmbeddingBackfillResult {
  success: boolean;
  processed: number;
  skipped: number;
  errors: number;
  total: number;
  message: string;
}

/**
 * Service to handle backfilling missing journal embeddings
 */
export class EmbeddingBackfillService {
  
  /**
   * Triggers the generation of missing embeddings for the current user
   */
  static async generateMissingEmbeddings(userId: string): Promise<EmbeddingBackfillResult> {
    try {
      console.log('[EmbeddingBackfillService] Starting embedding generation for user:', userId);

      // Get the current session to pass authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      // Call the edge function to generate missing embeddings
      const { data, error } = await supabase.functions.invoke('generate-missing-embeddings', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('[EmbeddingBackfillService] Error calling function:', error);
        throw error;
      }

      console.log('[EmbeddingBackfillService] Embedding generation result:', data);

      return {
        success: true,
        processed: data.processed || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
        total: data.total || 0,
        message: data.message || 'Embeddings generated successfully'
      };

    } catch (error) {
      console.error('[EmbeddingBackfillService] Failed to generate embeddings:', error);
      
      return {
        success: false,
        processed: 0,
        skipped: 0,
        errors: 1,
        total: 0,
        message: error instanceof Error ? error.message : 'Failed to generate embeddings'
      };
    }
  }

  /**
   * Checks how many journal entries are missing embeddings
   */
  static async checkMissingEmbeddings(userId: string): Promise<{ missing: number; total: number }> {
    try {
      // Get total journal entries for user
      const { count: totalEntries, error: totalError } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (totalError) {
        throw totalError;
      }

      // Get user's journal entry IDs
      const { data: userEntries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id')
        .eq('user_id', userId);

      if (entriesError) {
        throw entriesError;
      }

      const entryIds = userEntries?.map(entry => entry.id) || [];

      // Get existing embeddings for user's entries
      const { count: existingEmbeddings, error: embeddingError } = await supabase
        .from('journal_embeddings')
        .select('*', { count: 'exact', head: true })
        .in('journal_entry_id', entryIds);

      if (embeddingError) {
        throw embeddingError;
      }

      const total = totalEntries || 0;
      const existing = existingEmbeddings || 0;
      const missing = Math.max(0, total - existing);

      console.log('[EmbeddingBackfillService] Embedding status:', {
        total,
        existing,
        missing,
        userId
      });

      return { missing, total };

    } catch (error) {
      console.error('[EmbeddingBackfillService] Error checking missing embeddings:', error);
      return { missing: 0, total: 0 };
    }
  }
}