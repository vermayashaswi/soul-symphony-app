
import { supabase } from '@/integrations/supabase/client';

/**
 * Tests the database connection
 * @returns Result with success status and error message if applicable
 */
export async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Use a timeout to prevent hanging connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Use the type-safe approach with a known table name instead of variable string
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Database connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Database connection test successful');
    return { success: true, data };
  } catch (err: any) {
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
    
    const { data, error } = await query.select();
    
    if (error) {
      console.error(`Error updating ${table}:`, error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (err) {
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
    
    // Execute as single or multiple
    const { data, error } = options.single 
      ? await query.maybeSingle() 
      : await query;
    
    if (error) {
      console.error(`Error selecting from ${table}:`, error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error(`Exception in safeSelect for ${table}:`, err);
    return { success: false, error: err };
  }
}
