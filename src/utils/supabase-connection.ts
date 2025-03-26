
import { supabase } from '@/integrations/supabase/client';

/**
 * Tests the connection to the Supabase database
 * @returns An object with the test results
 */
export const testDatabaseConnection = async () => {
  try {
    const start = Date.now();
    console.log('Testing Supabase connection...');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    const duration = Date.now() - start;
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message, duration };
    }
    
    console.log(`Supabase connection successful (${duration}ms)`);
    return { success: true, duration, data };
  } catch (err) {
    console.error('Supabase connection error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error', duration: -1 };
  }
};
