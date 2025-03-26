
import { supabase } from '@/integrations/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';

type TableName = 'profiles' | 'Journal Entries' | 'chat_threads' | 'chat_messages' | 'journal_embeddings' | 'user_queries' | 'user_sessions';

/**
 * Tests the connection to the Supabase database with improved error handling
 * @returns An object with the test results
 */
export const testDatabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // Create a new AbortController with a reasonable timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    // Use a simple query to test the connection - using the signal from controller
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Supabase connection test failed:', error.message);
      return { success: false, error: 'Database connection failed' };
    }
    
    console.log('Supabase connection successful');
    return { success: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Connection test aborted due to timeout');
      return { success: false, error: 'Connection timed out' };
    }
    
    console.error('Supabase connection error:', err);
    return { success: false, error: 'Connection error' };
  }
};

/**
 * Helper to handle typesafe Supabase operations with error checking
 */
export const safeQuerySingle = async <T>(
  query: Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<T | null> => {
  try {
    const { data, error } = await query;
    if (error) {
      console.error('Database query error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Unexpected error in database query:', err);
    return null;
  }
};

/**
 * Helper for safely inserting records with proper type handling
 */
export const safeInsert = async <T>(
  tableName: TableName, 
  values: any,
  options?: { select?: boolean }
): Promise<T | null> => {
  try {
    let query = supabase.from(tableName).insert(values);
    
    if (options?.select !== false) {
      query = query.select();
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error inserting into ${tableName}:`, error);
      return null;
    }
    
    return data as unknown as T;
  } catch (err) {
    console.error(`Unexpected error inserting into ${tableName}:`, err);
    return null;
  }
};

/**
 * Helper for safely updating records with proper type handling
 */
export const safeUpdate = async <T>(
  tableName: TableName,
  values: any,
  condition: Record<string, any>
): Promise<T | null> => {
  try {
    let query = supabase.from(tableName).update(values);
    
    // Apply conditions
    Object.entries(condition).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data, error } = await query.select();
    
    if (error) {
      console.error(`Error updating ${tableName}:`, error);
      return null;
    }
    
    return data as unknown as T;
  } catch (err) {
    console.error(`Unexpected error updating ${tableName}:`, err);
    return null;
  }
};

/**
 * Helper for safely selecting records with proper type handling
 */
export const safeSelect = async <T>(
  tableName: TableName,
  columns: string,
  condition?: Record<string, any>,
  options?: { single?: boolean, limit?: number }
): Promise<T | null> => {
  try {
    let query = supabase.from(tableName).select(columns);
    
    if (condition) {
      // Apply all conditions
      Object.entries(condition).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.single) {
      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.error(`Error selecting from ${tableName}:`, error);
        return null;
      }
      
      return data as unknown as T;
    } else {
      const { data, error } = await query;
      
      if (error) {
        console.error(`Error selecting from ${tableName}:`, error);
        return null;
      }
      
      return data as unknown as T;
    }
  } catch (err) {
    console.error(`Unexpected error selecting from ${tableName}:`, err);
    return null;
  }
};
