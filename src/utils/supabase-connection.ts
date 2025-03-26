
import { supabase } from '@/integrations/supabase/client';

/**
 * Tests the connection to the Supabase database
 * @returns An object with the test results
 */
export const testDatabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // Add a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Supabase connection successful');
    return { success: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Connection test aborted due to timeout');
      return { success: false, error: 'Connection timed out after 5 seconds' };
    }
    
    console.error('Supabase connection error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
};
