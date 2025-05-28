
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UseJournalEntriesReturn {
  data: any[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useJournalEntries = (): UseJournalEntriesReturn => {
  const { user, session } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['journal-entries', user?.id],
    queryFn: async () => {
      if (!user?.id || !session) {
        console.log('useJournalEntries: No user or session, returning empty array');
        return [];
      }

      console.log('useJournalEntries: Fetching entries for user:', user.id);

      try {
        const { data, error } = await supabase
          .from('Journal Entries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('useJournalEntries: Supabase error:', error);
          throw error;
        }

        console.log('useJournalEntries: Successfully fetched entries:', data?.length || 0);
        return data || [];
      } catch (error) {
        console.error('useJournalEntries: Error fetching journal entries:', error);
        throw error;
      }
    },
    enabled: !!(user?.id && session),
    retry: (failureCount, error) => {
      // Don't retry on auth-related errors
      if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: 1000,
  });

  return {
    data: data || [],
    isLoading,
    error: error as Error | null,
    refetch
  };
};
