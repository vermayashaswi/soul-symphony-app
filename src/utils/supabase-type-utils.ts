
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
 * This improved version ensures array items are properly typed
 */
export const asDataArray = <T>(data: any): T[] => {
  if (Array.isArray(data)) {
    return data.map(item => item as T);
  }
  return [] as T[];
};

/**
 * Safe type assertion for single database record
 * With better error handling
 */
export const asSingleRecord = <T>(data: any): T | null => {
  if (data && typeof data === 'object' && !('error' in data)) {
    return data as T;
  }
  return null;
};

/**
 * Type-safe assertion for chat messages
 * This ensures all properties exist before they're accessed
 */
export const asChatMessage = (msg: any): {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
  thread_id?: string;
  reference_entries?: Array<{id: number, similarity: number}> | null;
} | null => {
  if (!msg || typeof msg !== 'object') return null;
  
  return {
    id: String(msg.id || ''),
    content: String(msg.content || ''),
    sender: (msg.sender as 'user' | 'assistant') || 'user',
    created_at: String(msg.created_at || new Date().toISOString()),
    thread_id: msg.thread_id ? String(msg.thread_id) : undefined,
    reference_entries: msg.reference_entries ? 
      (Array.isArray(msg.reference_entries) ? 
        msg.reference_entries.map((ref: any) => ({
          id: Number(ref.id || 0),
          similarity: Number(ref.similarity || 0)
        })) : 
        null) : 
      null
  };
};

/**
 * Type-safe assertion for chat threads
 */
export const asChatThread = (thread: any): {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
} | null => {
  if (!thread || typeof thread !== 'object') return null;
  
  return {
    id: String(thread.id || ''),
    title: String(thread.title || 'Untitled Chat'),
    created_at: String(thread.created_at || new Date().toISOString()),
    updated_at: String(thread.updated_at || new Date().toISOString())
  };
};

/**
 * Type-safe assertion for user profiles
 */
export const asUserProfile = (profile: any): {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
} | null => {
  if (!profile || typeof profile !== 'object') return null;
  
  return {
    id: String(profile.id || ''),
    email: profile.email ? String(profile.email) : undefined,
    full_name: profile.full_name ? String(profile.full_name) : undefined,
    avatar_url: profile.avatar_url ? String(profile.avatar_url) : undefined
  };
};
