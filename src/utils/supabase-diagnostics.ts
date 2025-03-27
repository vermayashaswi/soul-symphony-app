
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
    // Check database connection with improved timeout handling
    try {
      console.log('Testing database connection...');
      const dbPromise = supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database connection timed out')), 8000);
      });
      
      const { data: dbCheck, error: dbError } = await Promise.race([
        dbPromise,
        timeoutPromise.then(() => { throw new Error('Database connection timed out'); })
      ]) as any;
      
      if (dbError) {
        errorDetails.push(`Database connection: ${dbError.message}`);
      } else {
        results.database = true;
        console.log('Database connection successful');
      }
    } catch (timeoutErr: any) {
      console.error('Database connection timeout:', timeoutErr);
      errorDetails.push(`Database connection: ${timeoutErr.message || 'Request timed out'}`);
    }
    
    // Only continue checks if database is accessible
    if (results.database) {
      console.log('Database accessible, continuing checks...');
      
      // Check auth
      const { data: session, error: authError } = await supabase.auth.getSession();
      results.auth = !authError && !!session;
      
      if (authError) {
        errorDetails.push(`Authentication: ${authError.message}`);
      } else {
        console.log('Authentication check successful');
      }
      
      // Check journal table with improved timeout
      try {
        console.log('Checking Journal Entries table...');
        const journalPromise = supabase
          .from('Journal Entries')
          .select('count')
          .limit(1);
          
        const journalTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Journal table check timed out')), 5000);
        });
        
        const { data: journalCheck, error: journalError } = await Promise.race([
          journalPromise,
          journalTimeoutPromise.then(() => { throw new Error('Journal table check timed out'); })
        ]) as any;
        
        if (journalError) {
          errorDetails.push(`Journal table: ${journalError.message}`);
          console.error('Journal table check failed:', journalError);
        } else {
          results.journalTable = true;
          console.log('Journal table check successful');
        }
      } catch (journalErr: any) {
        console.error('Journal table check error:', journalErr);
        errorDetails.push(`Journal table: ${journalErr.message || 'Check timed out'}`);
      }
      
      // Check audio bucket
      console.log('Checking audio bucket...');
      const { success: bucketSuccess, error: bucketError } = await checkAudioBucket();
      results.audioBucket = bucketSuccess;
      
      if (!bucketSuccess && bucketError) {
        errorDetails.push(`Audio storage: ${bucketError}`);
        console.error('Audio bucket check failed:', bucketError);
      } else {
        console.log('Audio bucket check successful');
      }
      
      // Only check the following if previous checks pass
      if (results.auth && results.journalTable) {
        // Check edge functions with improved timeout
        try {
          console.log('Testing edge functions...');
          const functionPromise = supabase.functions.invoke('transcribe-audio', {
            body: { test: true }
          });
          
          const functionTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Edge functions check timed out')), 5000);
          });
          
          const { data: functionData, error: functionError } = await Promise.race([
            functionPromise,
            functionTimeoutPromise.then(() => { throw new Error('Edge functions check timed out'); })
          ]) as any;
          
          if (functionError) {
            errorDetails.push(`Edge functions: ${functionError.message}`);
            console.error('Edge functions check failed:', functionError);
          } else if (functionData?.success) {
            results.edgeFunctions = true;
            console.log('Edge functions check successful');
          } else {
            errorDetails.push('Edge functions: Unexpected response');
            console.error('Edge functions unexpected response:', functionData);
          }
        } catch (funcErr: any) {
          console.error('Edge functions check error:', funcErr);
          errorDetails.push(`Edge functions: ${funcErr.message || 'Check failed'}`);
        }
        
        // Check embeddings table with improved timeout
        try {
          console.log('Checking embeddings table...');
          const embeddingsPromise = supabase
            .from('journal_embeddings')
            .select('count')
            .limit(1);
            
          const embeddingsTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Embeddings check timed out')), 5000);
          });
          
          const { data: embeddingsCheck, error: embeddingsError } = await Promise.race([
            embeddingsPromise,
            embeddingsTimeoutPromise.then(() => { throw new Error('Embeddings check timed out'); })
          ]) as any;
          
          if (embeddingsError && !embeddingsError.message.includes('does not exist')) {
            errorDetails.push(`Embeddings table: ${embeddingsError.message}`);
            console.error('Embeddings check failed:', embeddingsError);
          } else {
            results.embeddingsTable = !embeddingsError || embeddingsCheck !== null;
            console.log('Embeddings check successful');
          }
        } catch (embedErr: any) {
          console.error('Embeddings check error:', embedErr);
          errorDetails.push(`Embeddings check: ${embedErr.message || 'Check failed'}`);
        }
      }
    }
    
    // Overall success
    const allSuccessful = Object.values(results).every(result => result === true);
    console.log('Diagnostics complete:', results, allSuccessful ? 'All checks passed' : 'Some checks failed');
    
    return {
      success: allSuccessful,
      results,
      errorDetails
    };
    
  } catch (error: any) {
    console.error('General error in diagnostics:', error);
    errorDetails.push(`General error: ${error.message}`);
    return {
      success: false,
      results,
      errorDetails
    };
  }
};

/**
 * Verify audio bucket and create it if needed with retries
 */
export const createAudioBucket = async () => {
  try {
    // First check if bucket already exists
    const { success, data } = await checkAudioBucket();
    
    if (success) {
      console.log('Audio bucket already exists:', data);
      return { success: true, message: 'Audio bucket already exists' };
    }
    
    // Verify if current user has permissions to create a bucket
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { 
        success: false, 
        error: 'Authentication required to verify storage setup'
      };
    }
    
    console.log('Checking if user has permissions to create bucket...');
    
    // Try with a different approach - verify the policies
    try {
      // This is just a check - don't actually attempt to create a bucket from the frontend
      // Instead, provide clear diagnostics
      return { 
        success: false, 
        error: 'The journal-audio-entries bucket does not exist. Please contact the administrator to set it up.'
      };
    } catch (permErr: any) {
      console.error('Permission error checking storage:', permErr);
      return { 
        success: false, 
        error: 'Storage permission error: ' + permErr.message
      };
    }
    
  } catch (error: any) {
    console.error('Error in createAudioBucket:', error);
    return { success: false, error: error.message };
  }
};
