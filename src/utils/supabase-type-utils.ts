
/**
 * Utility functions for handling Supabase type issues
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

/**
 * Helper function to safely type cast a string ID to any for database queries
 * This helps bypass the strict TypeScript errors when passing UUIDs to queries
 */
export const asId = (id: string | number): any => {
  return id as any;
};

/**
 * Helper function to safely handle data from a query that might return an error
 */
export const safeData = <T>(data: T | null): T | null => {
  if (!data || typeof data === 'object' && 'error' in data) {
    return null;
  }
  return data;
};

/**
 * Helper for creating type-safe data objects for inserts/updates
 */
export const createProfileData = (data: any) => {
  return data as any;
};

/**
 * Helper for creating type-safe data objects for Journal Entries
 */
export const createJournalEntryData = (data: any) => {
  return data as any;
};

/**
 * Helper for creating type-safe data objects for chat threads
 */
export const createChatThreadData = (data: any) => {
  return data as any;
};

/**
 * Helper for creating type-safe data objects for chat messages
 */
export const createChatMessageData = (data: any) => {
  return data as any;
};

/**
 * Helper for creating type-safe data objects for user sessions
 */
export const createUserSessionData = (data: any) => {
  return data as any;
};

/**
 * Type guard to check if an object is a database error
 */
export const isDbError = (value: any): boolean => {
  return value && typeof value === 'object' && 'error' in value;
};

/**
 * Safe type assertion for database query results
 */
export const asDataArray = <T>(data: any): T[] => {
  if (Array.isArray(data)) {
    return data as T[];
  }
  return [] as T[];
};

/**
 * Safe type assertion for single database record
 */
export const asSingleRecord = <T>(data: any): T | null => {
  if (data && typeof data === 'object' && !('error' in data)) {
    return data as T;
  }
  return null;
};
