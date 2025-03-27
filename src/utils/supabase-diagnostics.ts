
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
    // Check database connection with timeout using Promise.race
    try {
      const dbPromise = supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out')), 8000);
      });
      
      const { data: dbCheck, error: dbError } = await Promise.race([
        dbPromise,
        timeoutPromise.then(() => { throw new Error('Database connection timed out'); })
      ]) as any;
      
      if (dbError) {
        errorDetails.push(`Database connection: ${dbError.message}`);
      } else {
        results.database = true;
      }
    } catch (timeoutErr: any) {
      errorDetails.push(`Database connection: ${timeoutErr.message || 'Request timed out'}`);
    }
    
    // Only continue checks if database is accessible
    if (results.database) {
      // Check auth
      const { data: session, error: authError } = await supabase.auth.getSession();
      results.auth = !authError && !!session;
      
      if (authError) {
        errorDetails.push(`Authentication: ${authError.message}`);
      }
      
      // Check journal table using Promise.race for timeout
      try {
        const journalPromise = supabase
          .from('Journal Entries')
          .select('count')
          .limit(1);
          
        const journalTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), 5000);
        });
        
        const { data: journalCheck, error: journalError } = await Promise.race([
          journalPromise,
          journalTimeoutPromise.then(() => { throw new Error('Journal table check timed out'); })
        ]) as any;
        
        if (journalError) {
          errorDetails.push(`Journal table: ${journalError.message}`);
        } else {
          results.journalTable = true;
        }
      } catch (journalErr: any) {
        errorDetails.push(`Journal table: ${journalErr.message || 'Check timed out'}`);
      }
      
      // Check audio bucket
      const { success: bucketSuccess, error: bucketError } = await checkAudioBucket();
      results.audioBucket = bucketSuccess;
      
      if (!bucketSuccess && bucketError) {
        errorDetails.push(`Audio storage: ${bucketError}`);
      }
      
      // Only check the following if previous checks pass
      if (results.auth && results.journalTable) {
        // Check edge functions with reduced timeout using Promise.race
        try {
          const functionPromise = supabase.functions.invoke('transcribe-audio', {
            body: { test: true }
          });
          
          const functionTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 5000);
          });
          
          const { data: functionData, error: functionError } = await Promise.race([
            functionPromise,
            functionTimeoutPromise.then(() => { throw new Error('Edge functions check timed out'); })
          ]) as any;
          
          if (functionError) {
            errorDetails.push(`Edge functions: ${functionError.message}`);
          } else if (functionData?.success) {
            results.edgeFunctions = true;
          } else {
            errorDetails.push('Edge functions: Unexpected response');
          }
        } catch (funcErr: any) {
          errorDetails.push(`Edge functions: ${funcErr.message || 'Check failed'}`);
        }
        
        // Check embeddings table with reduced timeout using Promise.race
        try {
          const embeddingsPromise = supabase
            .from('journal_embeddings')
            .select('count')
            .limit(1);
            
          const embeddingsTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timed out')), 5000);
          });
          
          const { data: embeddingsCheck, error: embeddingsError } = await Promise.race([
            embeddingsPromise,
            embeddingsTimeoutPromise.then(() => { throw new Error('Embeddings check timed out'); })
          ]) as any;
          
          if (embeddingsError && !embeddingsError.message.includes('does not exist')) {
            errorDetails.push(`Embeddings table: ${embeddingsError.message}`);
          } else {
            results.embeddingsTable = !embeddingsError || embeddingsCheck !== null;
          }
        } catch (embedErr: any) {
          errorDetails.push(`Embeddings check: ${embedErr.message || 'Check failed'}`);
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
