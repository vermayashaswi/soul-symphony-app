
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Checks if a Supabase edge function is working
 * @param functionName - Name of the edge function to check
 * @returns Promise with boolean result and error message if applicable
 */
export async function checkSupabaseFunction(functionName: string): Promise<{ isWorking: boolean; error?: string }> {
  try {
    console.log(`Checking if function '${functionName}' is working...`);
    
    // Make a lightweight request to the function
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { 
        healthCheck: true,
        timestamp: Date.now()
      }
    });
    
    if (error) {
      console.error(`Function '${functionName}' check failed:`, error);
      return {
        isWorking: false,
        error: error.message || 'Unknown error'
      };
    }
    
    console.log(`Function '${functionName}' response:`, data);
    
    // The function should return a health status in the response
    if (data && data.status === 'ok') {
      return {
        isWorking: true
      };
    } else {
      return {
        isWorking: false,
        error: 'Function returned unexpected response'
      };
    }
    
  } catch (err: any) {
    console.error(`Error checking function '${functionName}':`, err);
    return {
      isWorking: false,
      error: err.message || 'Unknown error occurred'
    };
  }
}

/**
 * Checks multiple Supabase functions and returns their status
 */
export async function checkAllSupabaseFunctions() {
  const functions = ['transcribe-audio', 'generate-themes'];
  const results: Record<string, { isWorking: boolean, error?: string }> = {};
  
  toast.info('Checking Supabase functions...');
  
  for (const functionName of functions) {
    results[functionName] = await checkSupabaseFunction(functionName);
  }
  
  return results;
}
