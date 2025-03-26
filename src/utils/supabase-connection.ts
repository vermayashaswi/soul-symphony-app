import { supabase } from '@/integrations/supabase/client';

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
    let query = supabase.from(table).update(updates);
    
    // Use a simpler approach to avoid TypeScript's deep type instantiation
    query = Object.entries(conditions).reduce((acc, [key, value]) => {
      return (acc as any).eq(key, value);
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
    // Start with the basic query
    let query = supabase.from(table).select(options.columns || '*');
    
    // Apply conditions using a for loop to avoid deep type recursion
    for (const [key, value] of Object.entries(conditions)) {
      query = (query as any).eq(key, value);
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
