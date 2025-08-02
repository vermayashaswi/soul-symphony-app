
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
 * FIXED: Triggers background processing for a journal entry after text edit
 * This function initiates analysis processes but ensures no entity conflicts
 */
export const triggerFullTextProcessing = async (entryId: number): Promise<void> => {
  console.log(`[theme-extractor] Triggering full text processing for entry: ${entryId}`);
  
  try {
    // Step 1: Trigger theme extraction (themes and categories only)
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

    // Step 2: FIXED: Trigger sentiment analysis WITH entity extraction
    // This ensures entities are extracted by the sentiment analysis function only
    try {
      // First fetch the entry text for sentiment analysis
      const { data: entryData, error: fetchError } = await supabase
        .from('Journal Entries')
        .select('"refined text"')
        .eq('id', entryId)
        .single();
        
      if (fetchError || !entryData || !entryData["refined text"]) {
        console.error("[theme-extractor] Error fetching entry text for sentiment analysis:", fetchError);
      } else {
        const { error: sentimentError } = await supabase.functions.invoke('analyze-sentiment', {
          body: {
            text: entryData["refined text"], // FIXED: Provide the required text parameter
            entryId: entryId,
            extractEntities: true // FIXED: Ensure entity extraction happens here
          }
        });
        
        if (sentimentError) {
          console.error("[theme-extractor] Error triggering sentiment analysis with entity extraction:", sentimentError);
        } else {
          console.log("[theme-extractor] Sentiment analysis with entity extraction triggered successfully");
        }
      }
    } catch (sentimentErr) {
      console.error("[theme-extractor] Error starting sentiment analysis with entity extraction:", sentimentErr);
    }
    
    // Step 3: Trigger emotions analysis
    try {
      const { data: entryData, error: fetchError } = await supabase
        .from('Journal Entries')
        .select('"refined text"')
        .eq('id', entryId)
        .single();
        
      if (fetchError || !entryData || !entryData["refined text"]) {
        console.error("[theme-extractor] Error fetching entry text for emotions analysis:", fetchError);
      } else {
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
