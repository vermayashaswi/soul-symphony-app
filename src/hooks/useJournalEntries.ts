
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
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['journal-entries', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!user?.id,
  });

  return {
    data: data || [],
    isLoading,
    error: error as Error | null,
    refetch
  };
};
