
/**
 * Utilities for extracting themes from journal entries
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Manually triggers theme extraction for a journal entry
 */
export async function triggerThemeExtraction(entryId: number): Promise<boolean> {
  try {
    console.log("Manually triggering theme extraction for entry:", entryId);
    
    // Get the entry text
    const { data: entryData, error: fetchError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text"')
      .eq('id', entryId)
      .single();
      
    if (fetchError) {
      console.error("Error fetching entry for theme extraction:", fetchError);
      return false;
    } 
    
    if (!entryData) {
      console.error("No entry data found for theme extraction");
      return false;
    }
    
    const text = entryData["refined text"] || entryData["transcription text"] || "";
    
    if (!text) {
      console.error("No text content found for theme extraction");
      return false;
    }
    
    // Call the generate-themes function directly
    console.log("Calling generate-themes with text:", text.substring(0, 50) + "...");
    const { error } = await supabase.functions.invoke('generate-themes', {
      body: {
        text: text,
        entryId: entryId
      }
    });
    
    if (error) {
      console.error("Error calling generate-themes:", error);
      return false;
    }
    
    console.log("Successfully triggered theme extraction");
    return true;
  } catch (themeErr) {
    console.error("Error manually triggering theme extraction:", themeErr);
    return false;
  }
}
