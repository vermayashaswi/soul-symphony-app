
import { JournalEntry } from '@/types/journal';

// Re-export common components and types
export type { JournalEntry }; // Fixed: Using 'export type' for type re-exports
export * from './JournalEntryCard';
export * from './JournalEntriesList';
export * from './JournalHeader';
export * from './JournalSearch';
export * from './DateRangeFilter';
export * from './ThemeBoxes';
export * from './EmptyJournalState';
export * from './JournalErrorBoundary';
