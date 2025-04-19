
import { supabase } from '@/integrations/supabase/client';

/**
 * Triggers theme extraction for a journal entry
 * This is specifically for refreshing the themes of an existing entry
 * without re-analyzing the entire text
 */
export const triggerThemeExtraction = async (entryId: number): Promise<boolean> => {
  console.log(`[theme-extractor] Triggering theme extraction for entry: ${entryId}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-themes', {
      body: { 
        entryId: entryId,
        fromEdit: false
      }
    });
    
    if (error) {
      console.error("[theme-extractor] Error triggering theme extraction:", error);
      return false;
    } else {
      console.log("[theme-extractor] Theme extraction triggered successfully:", data);
      return true;
    }
  } catch (error) {
    console.error("[theme-extractor] Error in triggerThemeExtraction:", error);
    return false;
  }
};

/**
 * Triggers background processing for a journal entry after text edit
 * This function initiates the same analysis processes that happen after voice transcription
 * but skips the audio processing steps since we already have text
 */
export const triggerFullTextProcessing = async (entryId: number): Promise<void> => {
  console.log(`[theme-extractor] Triggering full text processing for entry: ${entryId}`);
  
  try {
    // Step 1: First, trigger theme extraction with the "fromEdit" flag set to true
    // This ensures themes get regenerated completely for edited text
    const { data: themeData, error: themeError } = await supabase.functions.invoke('generate-themes', {
      body: { 
        entryId: entryId,
        fromEdit: true
      }
    });
    
    if (themeError) {
      console.error("[theme-extractor] Error triggering theme extraction:", themeError);
    } else {
      console.log("[theme-extractor] Theme extraction triggered successfully:", themeData);
    }

    // Step 2: Trigger entity extraction
    try {
      console.log("[theme-extractor] Starting entity extraction for entry:", entryId);
      const { error: entitiesError } = await supabase.functions.invoke('batch-extract-entities', {
        body: {
          processAll: false,
          diagnosticMode: false,
          entryIds: [entryId]  // Pass as array to match expected format
        }
      });
      
      if (entitiesError) {
        console.error("[theme-extractor] Error invoking batch-extract-entities:", entitiesError);
      } else {
        console.log("[theme-extractor] Successfully triggered entity extraction");
      }
    } catch (entityErr) {
      console.error("[theme-extractor] Error starting entity extraction:", entityErr);
    }

    // Step 3: Trigger sentiment analysis
    try {
      const { error: sentimentError } = await supabase.functions.invoke('batch-analyze-sentiment', {
        body: {
          entryIds: [entryId]
        }
      });
      
      if (sentimentError) {
        console.error("[theme-extractor] Error triggering sentiment analysis:", sentimentError);
      } else {
        console.log("[theme-extractor] Sentiment analysis triggered successfully");
      }
    } catch (sentimentErr) {
      console.error("[theme-extractor] Error starting sentiment analysis:", sentimentErr);
    }
    
    // Step 4: Trigger emotions analysis (using the same API endpoint used for new recordings)
    try {
      const { data: entryData, error: fetchError } = await supabase
        .from('Journal Entries')
        .select('"refined text"')
        .eq('id', entryId)
        .single();
        
      if (fetchError || !entryData || !entryData["refined text"]) {
        console.error("[theme-extractor] Error fetching entry text for emotions analysis:", fetchError);
      } else {
        // Call the OpenAI API through the edge function for emotions analysis
        // This is the same endpoint used for new recordings
        const { error: emotionsError } = await supabase.functions.invoke('analyze-emotions', {
          body: {
            entryId: entryId,
            text: entryData["refined text"]
          }
        });
        
        if (emotionsError) {
          console.error("[theme-extractor] Error triggering emotions analysis:", emotionsError);
        } else {
          console.log("[theme-extractor] Emotions analysis triggered successfully");
        }
      }
    } catch (emotionsErr) {
      console.error("[theme-extractor] Error starting emotions analysis:", emotionsErr);
    }
    
    console.log(`[theme-extractor] All analysis jobs triggered for entry: ${entryId}`);
    
  } catch (error) {
    console.error("[theme-extractor] Error in triggerFullTextProcessing:", error);
    throw error;
  }
};
