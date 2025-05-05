import { v4 as uuidv4 } from 'uuid';
import { getEntryIdForProcessingId } from './index';
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

const processingEntries: { [key: string]: ProcessingEntry } = {};

export const setHasPreviousEntries = (hasEntries: boolean) => {
  localStorage.setItem('hasPreviousEntries', JSON.stringify(hasEntries));
};

export const getHasPreviousEntries = (): boolean => {
  const storedValue = localStorage.getItem('hasPreviousEntries');
  return storedValue ? JSON.parse(storedValue) : false;
};

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

  processingEntries[tempId] = {
    userId: userId,
    tempId: tempId,
    timestamp: Date.now(),
    timezoneName,
    timezoneOffset,
  };

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

export const getAllProcessingEntries = (): ProcessingEntry[] => {
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
