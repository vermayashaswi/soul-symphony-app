
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
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { test: true }
      });
      
      results.results.edgeFunctions = !error;
      if (error) {
        results.errorDetails.push(`Edge functions error: ${error.message}`);
      }
    } catch (e: any) {
      results.results.edgeFunctions = false;
      results.errorDetails.push(`Could not connect to edge functions: ${e.message || 'Unknown error'}`);
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
    // Create RLS policy for audio storage
    const policySetup = async () => {
      try {
        // Allow users to create folders/read their own data
        const { error: policyError } = await supabase.rpc('create_storage_policy', {
          bucket_name: 'audio',
          policy_name: 'Allow individual user access',
          definition: "(auth.uid() = owner) OR (bucket_id = 'audio' AND name LIKE auth.uid() || '/%')"
        });
        
        if (policyError) {
          console.warn('Policy creation may have failed, but bucket might still work:', policyError);
        }
        
        return !policyError;
      } catch (err) {
        console.warn('Could not set up storage policies, continuing anyway:', err);
        return false;
      }
    };
    
    // Try up to 3 times to create the bucket, with a delay between attempts
    let bucketCreated = false;
    let attempts = 0;
    
    while (!bucketCreated && attempts < 3) {
      attempts++;
      bucketCreated = await ensureAudioBucketExists();
      
      if (!bucketCreated) {
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Retrying bucket creation, attempt ${attempts}`);
      } else {
        // Try to set up policies, but don't fail if it doesn't work
        await policySetup();
      }
    }
    
    if (bucketCreated) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to create audio bucket after multiple attempts' };
    }
  } catch (error: any) {
    console.error('Error in createAudioBucket:', error);
    return { success: false, error: error.message };
  }
}
