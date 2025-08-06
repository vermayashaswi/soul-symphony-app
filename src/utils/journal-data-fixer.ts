import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Utility functions to fix journal entry data issues
 */

export interface DataFixResult {
  success: boolean;
  entriesProcessed: number;
  errors: string[];
  message: string;
}


/**
 * Regenerates missing data for a specific journal entry
 */
export const regenerateEntryData = async (entryId: number): Promise<DataFixResult> => {
  try {
    console.log(`[DataFixer] Regenerating data for entry ${entryId}`);
    
    const { data, error } = await supabase.rpc('regenerate_missing_data_for_entry', {
      target_entry_id: entryId
    });
    
    if (error) {
      console.error('[DataFixer] Error regenerating entry data:', error);
      return {
        success: false,
        entriesProcessed: 0,
        errors: [error.message],
        message: 'Failed to regenerate entry data'
      };
    }
    
    // Trigger the full processing pipeline for this entry
    await triggerEntryReprocessing(entryId);
    
    return {
      success: true,
      entriesProcessed: 1,
      errors: [],
      message: 'Entry data regeneration initiated successfully'
    };
    
  } catch (error: any) {
    console.error('[DataFixer] Exception in regenerateEntryData:', error);
    return {
      success: false,
      entriesProcessed: 0,
      errors: [error.message],
      message: 'Failed to regenerate entry data'
    };
  }
};

/**
 * Triggers reprocessing of a journal entry through the analysis pipeline
 */
export const triggerEntryReprocessing = async (entryId: number): Promise<void> => {
  try {
    console.log(`[DataFixer] Triggering reprocessing for entry ${entryId}`);
    
    // Get the entry text
    const { data: entryData, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('"refined text"')
      .eq('id', entryId)
      .single();
      
    if (fetchError || !entryData || !entryData["refined text"]) {
      throw new Error('Could not fetch entry text for reprocessing');
    }
    
    const textToProcess = entryData["refined text"];
    
    // 1. Trigger theme extraction
    const { error: themeError } = await supabase.functions.invoke('generate-themes', {
      body: { 
        text: textToProcess,
        entryId: entryId,
        fromEdit: true
      }
    });
    
    if (themeError) {
      console.error('[DataFixer] Error triggering theme extraction:', themeError);
    } else {
      console.log('[DataFixer] Theme extraction triggered successfully');
    }
    
    // 2. Trigger sentiment analysis with entity extraction
    const { error: sentimentError } = await supabase.functions.invoke('analyze-sentiment', {
      body: {
        text: textToProcess,
        entryId: entryId,
        extractEntities: true
      }
    });
    
    if (sentimentError) {
      console.error('[DataFixer] Error triggering sentiment analysis:', sentimentError);
    } else {
      console.log('[DataFixer] Sentiment analysis triggered successfully');
    }
    
    // 3. Trigger emotions analysis
    const { error: emotionsError } = await supabase.functions.invoke('analyze-emotions', {
      body: {
        text: textToProcess,
        entryId: entryId
      }
    });
    
    if (emotionsError) {
      console.error('[DataFixer] Error triggering emotions analysis:', emotionsError);
    } else {
      console.log('[DataFixer] Emotions analysis triggered successfully');
    }
    
    console.log(`[DataFixer] All reprocessing jobs triggered for entry ${entryId}`);
    
  } catch (error) {
    console.error('[DataFixer] Error in triggerEntryReprocessing:', error);
    throw error;
  }
};

/**
 * Checks for entries with missing or inconsistent data
 */
export const findProblematicEntries = async (userId?: string): Promise<{
  missingThemes: number[];
  missingSentiment: number[];
  missingEmbeddings: number[];
  inconsistentData: number[];
}> => {
  try {
    console.log('[DataFixer] Scanning for problematic entries');
    
    let query = supabase
      .from('Journal Entries')
      .select('id, themes, master_themes, sentiment, emotions, entities');
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: entries, error } = await query;
    
    if (error) {
      console.error('[DataFixer] Error fetching entries:', error);
      throw error;
    }
    
    const missingThemes: number[] = [];
    const missingSentiment: number[] = [];
    const inconsistentData: number[] = [];
    
    entries?.forEach(entry => {
      // Check for missing themes
      if ((!entry.themes || entry.themes.length === 0) && 
          (!entry.master_themes || entry.master_themes.length === 0)) {
        missingThemes.push(entry.id);
      }
      
      // Check for missing sentiment
      if (!entry.sentiment || entry.sentiment === '0' || entry.sentiment === '') {
        missingSentiment.push(entry.id);
      }
      
      // Check for inconsistent data (has one type of analysis but missing others)
      const hasThemes = (entry.themes && entry.themes.length > 0) || 
                       (entry.master_themes && entry.master_themes.length > 0);
      const hasSentiment = entry.sentiment && entry.sentiment !== '0';
      const hasEmotions = entry.emotions && Object.keys(entry.emotions).length > 0;
      const hasEntities = entry.entities && Object.keys(entry.entities).length > 0;
      
      const analysisCount = [hasThemes, hasSentiment, hasEmotions, hasEntities].filter(Boolean).length;
      
      // If only some analysis is present, it's inconsistent
      if (analysisCount > 0 && analysisCount < 3) {
        inconsistentData.push(entry.id);
      }
    });
    
    // Check for missing embeddings - RLS will automatically filter to user's entries
    const { data: embeddingData, error: embeddingError } = await supabase
      .from('journal_embeddings')
      .select('journal_entry_id');
      
    if (embeddingError) {
      console.error('[DataFixer] Error checking embeddings:', embeddingError);
    }
    
    const entriesWithEmbeddings = new Set(embeddingData?.map(e => e.journal_entry_id) || []);
    const allEntryIds = entries?.map(e => e.id) || [];
    const missingEmbeddings = allEntryIds.filter(id => !entriesWithEmbeddings.has(id));
    
    console.log('[DataFixer] Scan complete:', {
      missingThemes: missingThemes.length,
      missingSentiment: missingSentiment.length,
      missingEmbeddings: missingEmbeddings.length,
      inconsistentData: inconsistentData.length
    });
    
    return {
      missingThemes,
      missingSentiment,
      missingEmbeddings,
      inconsistentData
    };
    
  } catch (error) {
    console.error('[DataFixer] Error in findProblematicEntries:', error);
    throw error;
  }
};

/**
 * Batch regenerates data for multiple entries
 */
export const batchRegenerateEntries = async (entryIds: number[]): Promise<DataFixResult> => {
  const errors: string[] = [];
  let processedCount = 0;
  
  console.log(`[DataFixer] Starting batch regeneration for ${entryIds.length} entries`);
  
  // Process in smaller batches to avoid overwhelming the system
  const batchSize = 5;
  
  for (let i = 0; i < entryIds.length; i += batchSize) {
    const batch = entryIds.slice(i, i + batchSize);
    
    await Promise.allSettled(
      batch.map(async (entryId) => {
        try {
          const result = await regenerateEntryData(entryId);
          if (result.success) {
            processedCount++;
          } else {
            errors.push(`Entry ${entryId}: ${result.errors.join(', ')}`);
          }
        } catch (error: any) {
          errors.push(`Entry ${entryId}: ${error.message}`);
        }
      })
    );
    
    // Small delay between batches
    if (i + batchSize < entryIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const success = processedCount > 0;
  const message = success 
    ? `Successfully initiated regeneration for ${processedCount} entries${errors.length > 0 ? ` (${errors.length} failed)` : ''}`
    : 'Failed to regenerate any entries';
  
  return {
    success,
    entriesProcessed: processedCount,
    errors,
    message
  };
};

/**
 * Main function to fix all data issues for a user
 */
export const fixAllDataIssues = async (userId?: string): Promise<DataFixResult> => {
  try {
    toast.info('Scanning for data issues...');
    
    const issues = await findProblematicEntries(userId);
    
    // Combine all problematic entries (remove duplicates)
    const allProblematicEntries = [
      ...new Set([
        ...issues.missingThemes,
        ...issues.missingSentiment,
        ...issues.inconsistentData
      ])
    ];
    
    if (allProblematicEntries.length === 0) {
      toast.success('No data issues found!');
      return {
        success: true,
        entriesProcessed: 0,
        errors: [],
        message: 'No data issues found'
      };
    }
    
    toast.info(`Found ${allProblematicEntries.length} entries with issues. Starting fixes...`);
    
    const result = await batchRegenerateEntries(allProblematicEntries);
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    
    return result;
    
  } catch (error: any) {
    console.error('[DataFixer] Error in fixAllDataIssues:', error);
    const errorMessage = 'Failed to fix data issues';
    toast.error(errorMessage);
    
    return {
      success: false,
      entriesProcessed: 0,
      errors: [error.message],
      message: errorMessage
    };
  }
};
