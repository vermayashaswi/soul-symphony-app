
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

/**
 * Generates themes for a journal entry using AI
 * @param entry The journal entry to generate themes for
 * @returns Promise that resolves when theme generation is complete
 */
export const generateThemesForEntry = async (entry: JournalEntry) => {
  if (!entry["refined text"] || !entry.id) return;
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-themes', {
      body: { text: entry["refined text"], entryId: entry.id }
    });
    
    if (error) {
      console.error('Error generating themes:', error);
      return;
    }
    
    if (data?.themes) {
      entry.master_themes = data.themes;
      
      const { error: updateError } = await supabase
        .from('Journal Entries')
        .update({ master_themes: data.themes })
        .eq('id', entry.id);
        
      if (updateError) {
        console.error('Error updating entry with themes:', updateError);
      }
    }
  } catch (error) {
    console.error('Error invoking generate-themes function:', error);
  }
};
