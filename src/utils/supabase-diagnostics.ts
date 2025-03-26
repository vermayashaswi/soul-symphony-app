
import { supabase } from '@/integrations/supabase/client';
import { ensureAudioBucketExists } from '@/utils/audio-processing';

/**
 * Diagnoses common database and configuration issues
 * @returns Results of diagnostic checks
 */
export async function diagnoseDatabaseIssues() {
  const results = {
    success: false,
    results: {
      database: false,
      auth: false,
      journalTable: false,
      audioBucket: false,
      edgeFunctions: false,
      embeddingsTable: false
    },
    errorDetails: [] as string[]
  };

  try {
    // Check database connection
    console.log('Checking database connection...');
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
      
    results.results.database = !profilesError;
    if (profilesError) {
      results.errorDetails.push(`Database connection error: ${profilesError.message}`);
    }
    
    // Check auth service
    console.log('Checking auth service...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    results.results.auth = !sessionError && !!sessionData;
    if (sessionError) {
      results.errorDetails.push(`Auth service error: ${sessionError.message}`);
    }
    
    // Check Journal Entries table
    console.log('Checking Journal Entries table...');
    const { error: journalError } = await supabase
      .from('Journal Entries')
      .select('id')
      .limit(1);
      
    results.results.journalTable = !journalError;
    if (journalError) {
      results.errorDetails.push(`Journal table error: ${journalError.message}`);
    }
    
    // Check audio bucket
    console.log('Checking audio storage bucket...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    const audioBucket = buckets?.find(b => b.name === 'audio');
    results.results.audioBucket = !bucketsError && !!audioBucket;
    if (!audioBucket) {
      results.errorDetails.push('Audio storage bucket not found');
    }
    
    // Check edge functions
    console.log('Checking edge functions...');
    try {
      const response = await fetch('https://kwnwhgucnzqxndzjayyq.supabase.co/functions/v1/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });
      
      // 401 is expected if not authenticated, but means the function exists
      results.results.edgeFunctions = response.status === 401 || response.ok;
      if (!response.ok && response.status !== 401) {
        results.errorDetails.push(`Edge functions error: HTTP ${response.status}`);
      }
    } catch (e) {
      results.results.edgeFunctions = false;
      results.errorDetails.push('Could not connect to edge functions');
    }
    
    // Check embeddings table
    console.log('Checking embeddings table...');
    const { error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('id')
      .limit(1);
      
    results.results.embeddingsTable = !embeddingsError;
    if (embeddingsError) {
      results.errorDetails.push(`Embeddings table error: ${embeddingsError.message}`);
    }
    
    // Calculate overall success
    const allChecks = Object.values(results.results);
    results.success = allChecks.every(result => result === true);
    
    return results;
  } catch (error: any) {
    console.error('Error in diagnoseDatabaseIssues:', error);
    results.errorDetails.push(`Unexpected error: ${error.message}`);
    return results;
  }
}

/**
 * Creates the audio bucket if it doesn't exist
 * @returns Result of operation
 */
export async function createAudioBucket() {
  try {
    const bucketCreated = await ensureAudioBucketExists();
    
    if (bucketCreated) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to create audio bucket' };
    }
  } catch (error: any) {
    console.error('Error in createAudioBucket:', error);
    return { success: false, error: error.message };
  }
}
