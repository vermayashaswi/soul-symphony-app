/**
 * Utilities for extracting themes from journal entries
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Manually triggers theme extraction for a journal entry
 */
export async function triggerThemeExtraction(entryId: number): Promise<boolean> {
  try {
    console.log(`Starting theme extraction for entry ID: ${entryId}`);
    
    // Get the entry text
    const { data: entryData, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .eq('id', entryId)
      .maybeSingle();
      
    if (fetchError) {
      console.error(`Error fetching entry: ${fetchError.message}`);
      throw new Error(`Error fetching entry: ${fetchError.message}`);
    } 
    
    if (!entryData) {
      console.error("No entry data found for ID:", entryId);
      throw new Error("No entry data found");
    }
    
    const text = entryData["refined text"] || entryData["transcription text"] || "";
    
    if (!text) {
      console.error("No text content found for entry ID:", entryId);
      throw new Error("No text content found");
    }
    
    console.log(`Successfully fetched entry text (${text.length} chars), calling generate-themes function`);
    
    // Call the generate-themes function
    const { error, data } = await supabase.functions.invoke('generate-themes', {
      body: {
        text: text,
        entryId: entryId
      }
    });
    
    if (error) {
      console.error(`Error calling generate-themes: ${error.message}`);
      throw new Error(`Error calling generate-themes: ${error.message}`);
    }
    
    console.log(`Theme extraction completed successfully for entry ID: ${entryId}`, data);
    return true;
  } catch (err) {
    console.error("Error triggering theme extraction:", err);
    // Even if theme extraction fails, we don't want to block the user
    // The themes can be generated later
    return false;
  }
}

/**
 * Triggers full text processing for an entry including themes, sentiment, emotions, and entities
 */
export async function triggerFullTextProcessing(entryId: number): Promise<boolean> {
  try {
    console.log(`Starting full text processing for entry ID: ${entryId}`);
    
    // First clear existing analysis data
    const { error: clearError } = await supabase
      .from('Journal Entries')
      .update({ 
        themes: null,
        master_themes: null,
        sentiment: null,
        emotions: null,
        entities: null
      })
      .eq('id', entryId);
      
    if (clearError) {
      console.error(`Error clearing analysis data: ${clearError.message}`);
      throw clearError;
    }

    // Get the entry text
    const { data: entryData, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .eq('id', entryId)
      .maybeSingle();
      
    if (fetchError) {
      console.error(`Error fetching entry: ${fetchError.message}`);
      throw fetchError;
    } 
    
    if (!entryData) {
      console.error("No entry data found for ID:", entryId);
      throw new Error("No entry data found");
    }
    
    const text = entryData["refined text"] || entryData["transcription text"] || "";
    
    if (!text) {
      console.error("No text content found for entry ID:", entryId);
      throw new Error("No text content found");
    }

    // Call functions in parallel for better performance
    const [
      themesPromise,
      sentimentPromise,
      entitiesPromise
    ] = await Promise.allSettled([
      // Generate themes
      supabase.functions.invoke('generate-themes', {
        body: { text, entryId }
      }),
      
      // Analyze sentiment
      supabase.functions.invoke('analyze-sentiment', {
        body: { text }
      }),
      
      // Extract entities
      supabase.functions.invoke('batch-extract-entities', {
        body: {
          processAll: false,
          diagnosticMode: false,
          entryId: entryId
        }
      })
    ]);

    console.log('Processing results:', {
      themes: themesPromise.status,
      sentiment: sentimentPromise.status,
      entities: entitiesPromise.status
    });

    return true;
  } catch (err) {
    console.error("Error in full text processing:", err);
    return false;
  }
}
