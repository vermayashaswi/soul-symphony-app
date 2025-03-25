
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface JournalSearchResult {
  id: number;
  content: string;
  created_at: string;
  similarity: number;
  emotions?: string[] | null;
  master_themes?: string[] | null;
}

interface UseSearchReturn {
  searchResults: JournalSearchResult[];
  isSearching: boolean;
  searchQuery: string;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
}

export function useSearch(userId: string | undefined): UseSearchReturn {
  const [searchResults, setSearchResults] = useState<JournalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const search = async (query: string) => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    if (!userId) {
      toast.error('You must be signed in to search');
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      const response = await supabase.functions.invoke('search-journal', {
        body: {
          query: query.trim(),
          userId,
          similarityThreshold: 0.6,
          matchCount: 10
        }
      });

      if (response.error) {
        console.error('Search error:', response.error);
        toast.error('Failed to search journal entries');
        return;
      }

      const { results, count } = response.data;

      if (count === 0) {
        toast.info('No matching entries found');
      } else {
        toast.success(`Found ${count} matching entries`);
      }

      setSearchResults(results || []);
    } catch (error) {
      console.error('Error searching journal entries:', error);
      toast.error('Failed to search journal entries');
    } finally {
      setIsSearching(false);
    }
  };

  const clearResults = () => {
    setSearchResults([]);
    setSearchQuery('');
  };

  return {
    searchResults,
    isSearching,
    searchQuery,
    search,
    clearResults
  };
}
