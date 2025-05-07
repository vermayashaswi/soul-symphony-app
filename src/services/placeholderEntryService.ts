
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
   * Waits until entries are available for the user
   * Use this to ensure entries are loaded before critical UI operations
   */
  async waitUntilEntriesAvailable(userId: string, timeoutMs = 5000): Promise<boolean> {
    if (!userId) return false;
    
    const startTime = Date.now();
    
    try {
      while (Date.now() - startTime < timeoutMs) {
        const hasEntries = await this.userHasEntries(userId);
        
        if (hasEntries) {
          console.log('[PlaceholderEntryService] Entries are now available');
          return true;
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.warn('[PlaceholderEntryService] Timed out waiting for entries');
      return false;
    } catch (error) {
      console.error('[PlaceholderEntryService] Error waiting for entries:', error);
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
        
        // Verify entry creation with retries
        const created = await this.waitUntilEntriesAvailable(userId, 3000);
        return created;
      }
      
      // User already has entries, no need for placeholder
      return false;
    } catch (error) {
      console.error('[PlaceholderEntryService] Exception creating placeholder:', error);
      return false;
    }
  },
  
  /**
   * Ensures that at least one entry exists, even if it's a placeholder.
   * This is critical for new users to avoid DOM errors.
   * Returns true if entries are available (either existing or newly created).
   */
  async ensurePlaceholderWithVerification(userId: string): Promise<boolean> {
    if (!userId) return false;
    
    try {
      // First check if entries already exist
      const hasEntries = await this.userHasEntries(userId);
      
      if (hasEntries) {
        console.log('[PlaceholderEntryService] User already has entries, no placeholder needed');
        return true;
      }
      
      console.log('[PlaceholderEntryService] User has no entries, creating placeholder with verification');
      
      // Create the placeholder entry
      await this.createPlaceholderIfNeeded(userId);
      
      // Verify it was actually created by waiting and checking
      const entriesAvailable = await this.waitUntilEntriesAvailable(userId, 5000);
      
      if (!entriesAvailable) {
        // If still no entries after timeout, try one more time
        console.log('[PlaceholderEntryService] Retrying placeholder creation after timeout');
        await this.createPlaceholderIfNeeded(userId);
        return await this.waitUntilEntriesAvailable(userId, 2000);
      }
      
      return entriesAvailable;
    } catch (error) {
      console.error('[PlaceholderEntryService] Error ensuring placeholder with verification:', error);
      return false;
    }
  }
};

export default PlaceholderEntryService;
