
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useUserStats() {
  const [journalCount, setJournalCount] = useState<number | null>(null);
  const [maxStreak, setMaxStreak] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchUserStats() {
      if (!user) return;
      
      try {
        // Get journal entry count
        const { count: entryCount, error: entriesError } = await supabase
          .from('Journal Entries')  // Corrected table name to match the database schema
          .select('id', { count: 'exact' })
          .eq('user_id', user.id);
          
        if (entriesError) throw entriesError;
        setJournalCount(entryCount);
        
        // For now, use a placeholder for max streak
        // In a real implementation, this would calculate the actual streak
        setMaxStreak(3);
        
      } catch (error) {
        console.error('Error fetching user stats:', error);
      }
    }
    
    fetchUserStats();
  }, [user]);
  
  return {
    journalCount,
    maxStreak
  };
}
