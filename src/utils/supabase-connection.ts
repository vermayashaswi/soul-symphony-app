
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
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // Use a simple query to test the connection
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Supabase connection test failed');
      return { success: false, error: 'Database connection failed' };
    }
    
    console.log('Supabase connection successful');
    return { success: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Connection test aborted due to timeout');
      return { success: false, error: 'Connection timed out' };
    }
    
    console.error('Supabase connection error');
    return { success: false, error: 'Connection error' };
  }
};
