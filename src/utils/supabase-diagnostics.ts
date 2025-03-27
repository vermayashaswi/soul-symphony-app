import { supabase } from '@/integrations/supabase/client';

/**
 * Checks if the audio bucket exists on Supabase
 */
export const checkAudioBucket = async () => {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error checking buckets:', error);
      return { success: false, error: error.message };
    }
    
    const bucket = buckets?.find(b => b.name === 'journal-audio-entries');
    
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
    // Check database connection
    const { data: dbCheck, error: dbError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
      
    if (dbError) {
      errorDetails.push(`Database connection: ${dbError.message}`);
    } else {
      results.database = true;
    }
    
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
      .limit(1);
      
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
    
    // Check edge functions
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke('transcribe-audio', {
        body: { test: true }
      });
      
      if (functionError) {
        errorDetails.push(`Edge functions: ${functionError.message}`);
      } else if (functionData?.success) {
        results.edgeFunctions = true;
      } else {
        errorDetails.push('Edge functions: Unexpected response');
      }
    } catch (funcErr: any) {
      errorDetails.push(`Edge functions: ${funcErr.message}`);
    }
    
    // Check embeddings table
    const { data: embeddingsCheck, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('count')
      .limit(1);
      
    if (embeddingsError && !embeddingsError.message.includes('does not exist')) {
      errorDetails.push(`Embeddings table: ${embeddingsError.message}`);
    } else {
      results.embeddingsTable = !embeddingsError || embeddingsCheck !== null;
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
      error: 'Audio bucket does not exist. Please contact the administrator to set it up.'
    };
    
  } catch (error: any) {
    console.error('Error in createAudioBucket:', error);
    return { success: false, error: error.message };
  }
};
