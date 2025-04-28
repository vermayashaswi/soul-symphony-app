
import { useState, useRef, useCallback } from 'react';
import { JournalEntry } from '@/types/journal';

interface UseJournalEntriesStateResult {
  localEntries: JournalEntry[];
  filteredEntries: JournalEntry[];
  animatedEntryIds: number[];
  isSearchActive: boolean;
  setLocalEntries: (entriesUpdate: React.SetStateAction<JournalEntry[]>) => void;
  setFilteredEntries: React.Dispatch<React.SetStateAction<JournalEntry[]>>;
  setAnimatedEntryIds: React.Dispatch<React.SetStateAction<number[]>>;
  setIsSearchActive: React.Dispatch<React.SetStateAction<boolean>>;
  pendingDeletions: React.MutableRefObject<Set<number>>;
}

export function useJournalEntriesState(): UseJournalEntriesStateResult {
  const [localEntries, setLocalEntriesState] = useState<JournalEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [animatedEntryIds, setAnimatedEntryIds] = useState<number[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const pendingDeletions = useRef<Set<number>>(new Set());
  
  const setLocalEntries = useCallback((entriesUpdate: React.SetStateAction<JournalEntry[]>) => {
    const newEntries = typeof entriesUpdate === 'function' 
      ? entriesUpdate(localEntries || []) 
      : entriesUpdate;
    
    setLocalEntriesState(newEntries);
    
    console.log('[JournalEntriesList] Local entries updated, count:', newEntries.length);
  }, [localEntries]);

  return {
    localEntries,
    filteredEntries,
    animatedEntryIds,
    isSearchActive,
    setLocalEntries,
    setFilteredEntries,
    setAnimatedEntryIds,
    setIsSearchActive,
    pendingDeletions
  };
}
