
import { supabase } from '@/integrations/supabase/client';
import { JournalEntry } from '@/types/journal';

/**
 * Service to manage placeholder entries for new users to prevent state management issues
 * when a user with 0 entries attempts to create their first entry.
 */
export const PlaceholderEntryService = {
  /**
   * Checks if the user has any journal entries
   */
  async userHasEntries(userId: string): Promise<boolean> {
    if (!userId) return false;
    
    try {
      const { count, error } = await supabase
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (error) {
        console.error('[PlaceholderEntryService] Error checking entries:', error);
        return false;
      }
      
      return (count !== null && count > 0);
    } catch (error) {
      console.error('[PlaceholderEntryService] Exception checking entries:', error);
      return false;
    }
  },

  /**
   * Creates an invisible placeholder entry for users with 0 entries
   * This helps prevent state management issues during recording
   */
  async createPlaceholderIfNeeded(userId: string): Promise<boolean> {
    if (!userId) return false;
    
    try {
      // Check if user already has entries
      const hasEntries = await this.userHasEntries(userId);
      
      // Only create a placeholder if user has no entries
      if (!hasEntries) {
        console.log('[PlaceholderEntryService] Creating placeholder entry for new user');
        
        // Create a placeholder entry
        const placeholderEntry: Partial<JournalEntry> = {
          user_id: userId,
          content: "This is a placeholder entry to help with processing your first journal entry.",
          "refined text": "This is a placeholder entry to help with processing your first journal entry.",
          created_at: new Date().toISOString(),
          sentiment: "neutral",
          themes: ["placeholder"],
          master_themes: ["placeholder"]
        };
        
        const { error } = await supabase
          .from('Journal Entries')
          .insert(placeholderEntry);
          
        if (error) {
          console.error('[PlaceholderEntryService] Error creating placeholder:', error);
          return false;
        }
        
        return true;
      }
      
      // User already has entries, no need for placeholder
      return false;
    } catch (error) {
      console.error('[PlaceholderEntryService] Exception creating placeholder:', error);
      return false;
    }
  }
};

export default PlaceholderEntryService;
