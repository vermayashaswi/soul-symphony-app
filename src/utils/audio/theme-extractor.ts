
/**
 * Utilities for extracting themes from journal entries
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Manually triggers theme extraction for a journal entry
 */
export async function triggerThemeExtraction(entryId: number): Promise<boolean> {
  try {
    // Get the entry text
    const { data: entryData, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .eq('id', entryId)
      .single();
      
    if (fetchError) {
      throw new Error(`Error fetching entry: ${fetchError.message}`);
    } 
    
    if (!entryData) {
      throw new Error("No entry data found");
    }
    
    const text = entryData["refined text"] || entryData["transcription text"] || "";
    
    if (!text) {
      throw new Error("No text content found");
    }
    
    // Call the generate-themes function
    const { error } = await supabase.functions.invoke('generate-themes', {
      body: {
        text: text,
        entryId: entryId
      }
    });
    
    if (error) {
      throw new Error(`Error calling generate-themes: ${error.message}`);
    }
    
    return true;
  } catch (err) {
    console.error("Error triggering theme extraction:", err);
    // Even if theme extraction fails, we don't want to block the user
    // The themes can be generated later
    return false;
  }
}
