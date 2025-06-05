
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmbeddingGenerationResult {
  success: boolean;
  message: string;
  processedCount: number;
  errorCount?: number;
  totalFound?: number;
}

export class EmbeddingGenerationService {
  /**
   * Generate missing embeddings for the current user's journal entries
   */
  static async generateMissingEmbeddings(): Promise<EmbeddingGenerationResult> {
    try {
      console.log('[EmbeddingGenerationService] Starting embedding generation...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call the edge function to generate missing embeddings
      const { data, error } = await supabase.functions.invoke('generate-missing-embeddings', {
        body: {
          userId: user.id
        }
      });

      if (error) {
        console.error('[EmbeddingGenerationService] Error:', error);
        throw error;
      }

      console.log('[EmbeddingGenerationService] Result:', data);
      
      return data as EmbeddingGenerationResult;
      
    } catch (error) {
      console.error('[EmbeddingGenerationService] Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Check if user has any entries without embeddings
   */
  static async checkMissingEmbeddings(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // Count entries without embeddings
      const { data: entriesWithoutEmbeddings, error } = await supabase
        .from('Journal Entries')
        .select('id')
        .eq('user_id', user.id)
        .not('id', 'in', `(SELECT journal_entry_id FROM journal_embeddings)`);

      if (error) {
        console.error('[EmbeddingGenerationService] Error checking missing embeddings:', error);
        return 0;
      }

      return entriesWithoutEmbeddings?.length || 0;
      
    } catch (error) {
      console.error('[EmbeddingGenerationService] Error checking missing embeddings:', error);
      return 0;
    }
  }

  /**
   * Generate embeddings with user feedback
   */
  static async generateWithToast(): Promise<boolean> {
    try {
      // Check if there are missing embeddings first
      const missingCount = await this.checkMissingEmbeddings();
      
      if (missingCount === 0) {
        toast.success("All your journal entries already have embeddings!");
        return true;
      }

      toast.info(`Found ${missingCount} entries without embeddings. Generating now...`);
      
      const result = await this.generateMissingEmbeddings();
      
      if (result.success) {
        if (result.processedCount > 0) {
          toast.success(`Successfully generated embeddings for ${result.processedCount} entries!`);
        } else {
          toast.info("All entries already had embeddings.");
        }
        
        if (result.errorCount && result.errorCount > 0) {
          toast.warning(`${result.errorCount} entries had errors during processing.`);
        }
        
        return true;
      } else {
        toast.error("Failed to generate embeddings. Please try again.");
        return false;
      }
      
    } catch (error) {
      console.error('[EmbeddingGenerationService] Error:', error);
      toast.error("An error occurred while generating embeddings.");
      return false;
    }
  }
}
