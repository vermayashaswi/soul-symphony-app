
import { useState, useEffect, useRef } from 'react';
import { JournalEntry } from '@/types/journal';
import { getEntryIdForProcessingId } from '@/utils/audio-processing';

interface UseProcessingEntriesProps {
  entries: JournalEntry[];
  processingEntries: string[];
}

export function useProcessingEntries({ entries, processingEntries: initialProcessingEntries }: UseProcessingEntriesProps) {
  const [visibleProcessingEntries, setVisibleProcessingEntries] = useState<string[]>([]);
  const [persistedProcessingEntries, setPersistedProcessingEntries] = useState<string[]>([]);
  const [processingToActualEntry, setProcessingToActualEntry] = useState<Map<string, JournalEntry>>(new Map());
  const [transitionalLoadingEntries, setTransitionalLoadingEntries] = useState<string[]>([]);
  const [recentlyCompletedEntries, setRecentlyCompletedEntries] = useState<number[]>([]);
  const [processedProcessingIds, setProcessedProcessingIds] = useState<Set<string>>(new Set());
  const [deletedEntryIds, setDeletedEntryIds] = useState<Set<number>>(new Set());
  const [deletedProcessingTempIds, setDeletedProcessingTempIds] = useState<Set<string>>(new Set());
  const [fullyProcessedEntries, setFullyProcessedEntries] = useState<Set<number>>(new Set());
  const [processingCardShouldShow, setProcessingCardShouldShow] = useState(false);
  
  const processingToEntryMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (initialProcessingEntries.length > 0) {
      setPersistedProcessingEntries(prev => {
        const existing = new Set(prev);
        initialProcessingEntries.forEach(id => existing.add(id));
        return Array.from(existing);
      });
    }
  }, [initialProcessingEntries]);

  useEffect(() => {
    if (entries.length > 0 && persistedProcessingEntries.length > 0) {
      const entriesToAssign = new Map<string, JournalEntry>();
      
      persistedProcessingEntries.forEach(tempId => {
        const entryId = getEntryIdForProcessingId(tempId);
        if (entryId) {
          const matchingEntry = entries.find(entry => entry.id === entryId);
          if (matchingEntry) {
            entriesToAssign.set(tempId, matchingEntry);
            processingToEntryMap.current.set(tempId, entryId);
          }
        }
      });
      
      if (entriesToAssign.size > 0) {
        setProcessingToActualEntry(prev => {
          const updated = new Map(prev);
          entriesToAssign.forEach((entry, tempId) => {
            updated.set(tempId, entry);
          });
          return updated;
        });
      }
    }
  }, [entries, persistedProcessingEntries]);

  return {
    visibleProcessingEntries,
    persistedProcessingEntries,
    processingToEntryMap: processingToEntryMap.current,
    processingToActualEntry,
    transitionalLoadingEntries,
    recentlyCompletedEntries,
    processedProcessingIds,
    deletedEntryIds,
    deletedProcessingTempIds,
    fullyProcessedEntries,
    processingCardShouldShow,
    setProcessingCardShouldShow,
    setVisibleProcessingEntries,
    setPersistedProcessingEntries,
    setProcessingToActualEntry,
    setTransitionalLoadingEntries,
    setRecentlyCompletedEntries,
    setProcessedProcessingIds,
    setDeletedEntryIds,
    setDeletedProcessingTempIds,
    setFullyProcessedEntries
  };
}
