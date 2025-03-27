
import { supabase } from '@/integrations/supabase/client';

/**
 * Tests the database connection
 * @returns Result with success status and error message if applicable
 */
export async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Use a timeout promise instead of AbortController
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), 10000);
    });
    
    // Use the type-safe approach with a known table name
    const connectionPromise = supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    // Race the promises to implement timeout
    const { data, error } = await Promise.race([
      connectionPromise,
      timeoutPromise.then(() => { throw new Error('Connection timed out'); })
    ]) as any;
    
    if (error) {
      console.error('Database connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Database connection test successful');
    return { success: true, data };
  } catch (err: any) {
    if (err.message === 'Connection timed out') {
      console.error('Database connection test timed out');
      return { success: false, error: 'Connection timed out' };
    }
    
    console.error('Database connection error:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

/**
 * Safely performs a database update with conditions
 * This implementation avoids deep type recursion
 */
export async function safeUpdate<T>(
  table: string, 
  updates: Record<string, any>,
  conditions: Record<string, any>
) {
  try {
    // For type safety, we need to use 'any' for the dynamic table name
    // but we still maintain runtime safety through error handling
    let query = (supabase.from(table as any) as any).update(updates);
    
    // Use a simpler approach to avoid TypeScript's deep type instantiation
    query = Object.entries(conditions).reduce((acc, [key, value]) => {
      return acc.eq(key, value);
    }, query);
    
    // Use Promise.race for timeout instead of AbortController
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), 10000);
    });
    
    const queryPromise = query.select();
    
    // Race the promises
    const { data, error } = await Promise.race([
      queryPromise,
      timeoutPromise.then(() => { throw new Error('Operation timed out'); })
    ]) as any;
    
    if (error) {
      console.error(`Error updating ${table}:`, error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (err: any) {
    if (err.message === 'Operation timed out') {
      console.error(`Update operation for ${table} timed out`);
      return { success: false, error: { message: 'Operation timed out' } };
    }
    
    console.error(`Exception in safeUpdate for ${table}:`, err);
    return { success: false, error: err };
  }
}

/**
 * Safely performs a database select with conditions
 * This implementation avoids deep type recursion
 */
export async function safeSelect<T>(
  table: string,
  conditions: Record<string, any> = {},
  options: {
    columns?: string;
    orderBy?: string;
    ascending?: boolean;
    limit?: number;
    single?: boolean;
    timeoutMs?: number;
  } = {}
) {
  try {
    // For type safety with dynamic table names
    let query = (supabase.from(table as any) as any).select(options.columns || '*');
    
    // Apply conditions using a for loop to avoid deep type recursion
    for (const [key, value] of Object.entries(conditions)) {
      query = query.eq(key, value);
    }
    
    // Apply ordering if specified
    if (options.orderBy) {
      query = query.order(options.orderBy, { 
        ascending: options.ascending !== false 
      });
    }
    
    // Apply limit if specified
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    // Use Promise.race for timeout instead of AbortController
    const timeoutMs = options.timeoutMs || 10000;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });
    
    // Execute as single or multiple
    const selectPromise = options.single 
      ? query.maybeSingle()
      : query;
    
    // Race the promises
    const { data, error } = await Promise.race([
      selectPromise,
      timeoutPromise.then(() => { throw new Error('Operation timed out'); })
    ]) as any;
    
    if (error) {
      console.error(`Error selecting from ${table}:`, error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (err: any) {
    if (err.message === 'Operation timed out') {
      console.error(`Select operation for ${table} timed out`);
      return { success: false, error: { message: 'Operation timed out' } };
    }
    
    console.error(`Exception in safeSelect for ${table}:`, err);
    return { success: false, error: err };
  }
}
