
import { v4 as uuidv4 } from 'uuid';
import { getCurrentTimezone } from '@/services/timezoneService';

interface ProcessingEntry {
  userId: string;
  tempId: string;
  timestamp: number;
  audioSize?: number;
  duration?: number;
  timezoneName: string;
  timezoneOffset: number;
}

// State management for processing entries
const processingEntries: { [key: string]: ProcessingEntry } = {};
let processingLock = false;
let isEntryBeingProcessed = false;
let processingTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Local storage management
export const setHasPreviousEntries = (hasEntries: boolean) => {
  localStorage.setItem('hasPreviousEntries', JSON.stringify(hasEntries));
};

export const getHasPreviousEntries = (): boolean => {
  const storedValue = localStorage.getItem('hasPreviousEntries');
  return storedValue ? JSON.parse(storedValue) : false;
};

// Processing lock management
export const setProcessingLock = (state: boolean) => {
  processingLock = state;
};

export const getProcessingLock = (): boolean => {
  return processingLock;
};

export const setIsEntryBeingProcessed = (state: boolean) => {
  isEntryBeingProcessed = state;
};

export const getIsEntryBeingProcessed = (): boolean => {
  return isEntryBeingProcessed;
};

// Timeout management
export const setProcessingTimeoutId = (id: ReturnType<typeof setTimeout> | null) => {
  processingTimeoutId = id;
};

export const getProcessingTimeoutId = (): ReturnType<typeof setTimeout> | null => {
  return processingTimeoutId;
};

// Entry ID tracking
export const setEntryIdForProcessingId = (tempId: string, entryId: number) => {
  try {
    localStorage.setItem(`processingEntryId-${tempId}`, entryId.toString());
  } catch (error) {
    console.error('Error saving entry ID to local storage:', error);
  }
};

// Processing entries management
export const createProcessingEntry = (userId: string, tempId: string) => {
  if (!userId) {
    console.error('Cannot create processing entry: No user ID provided');
    return null;
  }

  // Get timezone information
  const { name: timezoneName, offset: timezoneOffset } = getCurrentTimezone();

  const newEntry: ProcessingEntry = {
    userId: userId,
    tempId: tempId,
    timestamp: Date.now(),
    timezoneName,
    timezoneOffset,
  };

  processingEntries[tempId] = newEntry;

  return newEntry;
};

export const updateProcessingEntry = (tempId: string, updates: Partial<ProcessingEntry>) => {
  if (!processingEntries[tempId]) {
    console.warn(`No processing entry found with tempId: ${tempId}`);
    return;
  }

  processingEntries[tempId] = {
    ...processingEntries[tempId],
    ...updates,
  };
};

export const getProcessingEntry = (tempId: string): ProcessingEntry | undefined => {
  return processingEntries[tempId];
};

export const getProcessingEntries = (): ProcessingEntry[] => {
  return Object.values(processingEntries);
};

export const removeProcessingEntry = (tempId: string) => {
  delete processingEntries[tempId];
};

export const clearAllProcessingEntries = () => {
  Object.keys(processingEntries).forEach(key => delete processingEntries[key]);
};

export const getProcessingEntriesForUser = (userId: string): ProcessingEntry[] => {
  return Object.values(processingEntries).filter(entry => entry.userId === userId);
};

// For backward compatibility
export const updateProcessingEntries = (entry: ProcessingEntry, operation: 'add' | 'update' | 'remove') => {
  if (operation === 'add' || operation === 'update') {
    processingEntries[entry.tempId] = entry;
  } else if (operation === 'remove') {
    delete processingEntries[entry.tempId];
  }
};

// Function to reset all processing state
export const resetProcessingState = () => {
  clearAllProcessingEntries();
  setProcessingLock(false);
  setIsEntryBeingProcessed(false);
  if (processingTimeoutId) {
    clearTimeout(processingTimeoutId);
    setProcessingTimeoutId(null);
  }
};
