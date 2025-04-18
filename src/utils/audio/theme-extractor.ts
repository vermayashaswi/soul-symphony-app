
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
