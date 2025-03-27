
import { supabase } from '@/integrations/supabase/client';

/**
 * Checks if the audio bucket exists on Supabase
 */
export const checkAudioBucket = async () => {
  try {
    // Add a debug log to track bucket check
    console.log('Checking if journal-audio-entries bucket exists');
    
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error checking buckets:', error);
      return { success: false, error: error.message };
    }
    
    // Look specifically for journal-audio-entries bucket name
    const bucket = buckets?.find(b => b.name === 'journal-audio-entries');
    
    console.log('Bucket check result:', bucket ? 'Found' : 'Not found');
    
    return { 
      success: !!bucket, 
      data: bucket
    };
  } catch (err: any) {
    console.error('Error checking audio bucket:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Diagnose database issues in the application
 */
export const diagnoseDatabaseIssues = async () => {
  const results = {
    database: false,
    auth: false,
    journalTable: false,
    audioBucket: false,
    edgeFunctions: false,
    embeddingsTable: false
  };
  
  const errorDetails: string[] = [];
  
  try {
    // Check database connection with timeout guard
    try {
      const { data: dbCheck, error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .abortSignal(AbortSignal.timeout(8000)); // 8 second timeout
      
      if (dbError) {
        errorDetails.push(`Database connection: ${dbError.message}`);
      } else {
        results.database = true;
      }
    } catch (timeoutErr) {
      errorDetails.push('Database connection: Request timed out');
    }
    
    // Only continue checks if database is accessible
    if (results.database) {
      // Check auth
      const { data: session, error: authError } = await supabase.auth.getSession();
      results.auth = !authError && !!session;
      
      if (authError) {
        errorDetails.push(`Authentication: ${authError.message}`);
      }
      
      // Check journal table
      const { data: journalCheck, error: journalError } = await supabase
        .from('Journal Entries')
        .select('count')
        .limit(1)
        .abortSignal(AbortSignal.timeout(5000));
        
      if (journalError) {
        errorDetails.push(`Journal table: ${journalError.message}`);
      } else {
        results.journalTable = true;
      }
      
      // Check audio bucket
      const { success: bucketSuccess, error: bucketError } = await checkAudioBucket();
      results.audioBucket = bucketSuccess;
      
      if (!bucketSuccess && bucketError) {
        errorDetails.push(`Audio storage: ${bucketError}`);
      }
      
      // Only check the following if previous checks pass
      if (results.auth && results.journalTable) {
        // Check edge functions with reduced timeout
        try {
          const functionSignal = AbortSignal.timeout(5000);
          
          const { data: functionData, error: functionError } = await supabase.functions.invoke('transcribe-audio', {
            body: { test: true },
            signal: functionSignal
          });
          
          if (functionError) {
            errorDetails.push(`Edge functions: ${functionError.message}`);
          } else if (functionData?.success) {
            results.edgeFunctions = true;
          } else {
            errorDetails.push('Edge functions: Unexpected response');
          }
        } catch (funcErr: any) {
          if (funcErr.name === 'AbortError' || funcErr.name === 'TimeoutError') {
            errorDetails.push('Edge functions: Request timed out');
          } else {
            errorDetails.push(`Edge functions: ${funcErr.message}`);
          }
        }
        
        // Check embeddings table with reduced timeout
        try {
          const embeddingsSignal = AbortSignal.timeout(5000);
          
          const { data: embeddingsCheck, error: embeddingsError } = await supabase
            .from('journal_embeddings')
            .select('count')
            .limit(1)
            .abortSignal(embeddingsSignal);
            
          if (embeddingsError && !embeddingsError.message.includes('does not exist')) {
            errorDetails.push(`Embeddings table: ${embeddingsError.message}`);
          } else {
            results.embeddingsTable = !embeddingsError || embeddingsCheck !== null;
          }
        } catch (embedErr: any) {
          if (embedErr.name === 'AbortError' || embedErr.name === 'TimeoutError') {
            errorDetails.push('Embeddings check: Request timed out');
          }
        }
      }
    }
    
    // Overall success
    const allSuccessful = Object.values(results).every(result => result === true);
    
    return {
      success: allSuccessful,
      results,
      errorDetails
    };
    
  } catch (error: any) {
    errorDetails.push(`General error: ${error.message}`);
    return {
      success: false,
      results,
      errorDetails
    };
  }
};

/**
 * Verify audio bucket and policies are properly configured
 */
export const createAudioBucket = async () => {
  try {
    // First check if bucket already exists
    const { success, data } = await checkAudioBucket();
    
    if (success) {
      console.log('Audio bucket already exists:', data);
      return { success: true, message: 'Audio bucket already exists' };
    }
    
    // Don't attempt to create bucket from frontend
    return { 
      success: false, 
      error: 'The journal-audio-entries bucket does not exist. Please contact the administrator to set it up.'
    };
    
  } catch (error: any) {
    console.error('Error in createAudioBucket:', error);
    return { success: false, error: error.message };
  }
};
