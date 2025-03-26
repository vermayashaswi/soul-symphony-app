
import { supabase } from '@/integrations/supabase/client';

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
 * This helps with the TypeScript issues related to Supabase queries
 */
export const safeQuerySingle = async <T>(
  query: Promise<{ data: T | null; error: any }>
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
  table: string, 
  values: Record<string, any>,
  options?: { select?: boolean }
): Promise<T | null> => {
  try {
    let query = supabase.from(table).insert(values);
    
    if (options?.select !== false) {
      query = query.select();
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error inserting into ${table}:`, error);
      return null;
    }
    
    return data as unknown as T;
  } catch (err) {
    console.error(`Unexpected error inserting into ${table}:`, err);
    return null;
  }
};

/**
 * Helper for safely updating records with proper type handling
 */
export const safeUpdate = async <T>(
  table: string,
  values: Record<string, any>,
  condition: Record<string, any>
): Promise<T | null> => {
  try {
    const { data, error } = await supabase
      .from(table)
      .update(values)
      .match(condition)
      .select();
    
    if (error) {
      console.error(`Error updating ${table}:`, error);
      return null;
    }
    
    return data as unknown as T;
  } catch (err) {
    console.error(`Unexpected error updating ${table}:`, err);
    return null;
  }
};

/**
 * Helper for safely selecting records with proper type handling
 */
export const safeSelect = async <T>(
  table: string,
  columns: string,
  condition?: Record<string, any>,
  options?: { single?: boolean, limit?: number }
): Promise<T | null> => {
  try {
    let query = supabase.from(table).select(columns);
    
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
        console.error(`Error selecting from ${table}:`, error);
        return null;
      }
      
      return data as unknown as T;
    } else {
      const { data, error } = await query;
      
      if (error) {
        console.error(`Error selecting from ${table}:`, error);
        return null;
      }
      
      return data as unknown as T;
    }
  } catch (err) {
    console.error(`Unexpected error selecting from ${table}:`, err);
    return null;
  }
};
