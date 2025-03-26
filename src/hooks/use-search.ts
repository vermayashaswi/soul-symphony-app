
import { useState, useCallback } from 'react';
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

  const search = useCallback(async (query: string) => {
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

    // Add retry logic for network failures
    const maxRetries = 3;
    let currentRetry = 0;
    let lastError = null;

    while (currentRetry < maxRetries) {
      try {
        // Invoke the updated edge function which handles the database interactions
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
          throw new Error(response.error.message || 'Failed to search journal entries');
        }

        const { results, count } = response.data;

        if (count === 0) {
          toast.info('No matching entries found');
        } else {
          toast.success(`Found ${count} matching entries`);
        }

        setSearchResults(results || []);
        setIsSearching(false);
        return; // Success! Exit the retry loop
      } catch (error) {
        lastError = error;
        currentRetry++;
        console.warn(`Search attempt ${currentRetry} failed:`, error);
        
        if (currentRetry >= maxRetries) {
          break;
        }
        
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, currentRetry - 1)));
      }
    }

    // If we get here, all retries failed
    console.error('Error searching journal entries after all retries:', lastError);
    toast.error('Failed to search journal entries. Please try again later.');
    setIsSearching(false);
  }, [userId]);

  const clearResults = useCallback(() => {
    setSearchResults([]);
    setSearchQuery('');
  }, []);

  return {
    searchResults,
    isSearching,
    searchQuery,
    search,
    clearResults
  };
}
