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
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error checking storage buckets:', listError);
      return { success: false, error: 'Failed to check storage buckets' };
    }
    
    const audioBucket = buckets?.find(bucket => bucket.name === 'audio');
    
    if (audioBucket) {
      console.log('Audio bucket already exists, checking policies');
      
      // Even if bucket exists, try to set up the policies to ensure proper access
      await setupBucketPolicies();
      return { success: true };
    }
    
    console.log('Creating audio bucket...');
    
    // Try to create the bucket
    const { error: createError } = await supabase.storage.createBucket('audio', {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
      allowedMimeTypes: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'],
    });
    
    if (createError) {
      console.error('Error creating audio bucket:', createError);
      return { success: false, error: `Failed to create audio bucket: ${createError.message}` };
    }
    
    // Set up storage policies
    const policiesSetup = await setupBucketPolicies();
    
    console.log('Audio bucket created successfully with policies');
    return { success: true };
  } catch (error: any) {
    console.error('Error in createAudioBucket:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sets up the storage policies for the audio bucket
 */
async function setupBucketPolicies() {
  try {
    // For select policy - allow users to read their own files
    const { error: selectPolicyError } = await supabase.storage.from('audio')
      .createSignedUrl('policy-test-file.txt', 60); // Just to check if policies work
      
    if (selectPolicyError && !selectPolicyError.message.includes('not found')) {
      console.log('Setting up audio bucket policies');
      
      // Use RPC function but with type assertion to avoid TypeScript error
      try {
        // Select policy - users can access their own files
        await (supabase.rpc as any)('create_storage_policy', {
          bucket_name: 'audio',
          policy_name: 'Allow individual user access - SELECT',
          operation: 'SELECT',
          definition: "(bucket_id = 'audio' AND (auth.uid() = owner OR path LIKE auth.uid() || '/%'))"
        });
        
        // Insert policy - users can upload their own files
        await (supabase.rpc as any)('create_storage_policy', {
          bucket_name: 'audio',
          policy_name: 'Allow individual user access - INSERT',
          operation: 'INSERT',
          definition: "(bucket_id = 'audio' AND path LIKE auth.uid() || '/%')"
        });
        
        // Update policy - users can update their own files
        await (supabase.rpc as any)('create_storage_policy', {
          bucket_name: 'audio',
          policy_name: 'Allow individual user access - UPDATE',
          operation: 'UPDATE',
          definition: "(bucket_id = 'audio' AND path LIKE auth.uid() || '/%')"
        });
        
        // Delete policy - users can delete their own files
        await (supabase.rpc as any)('create_storage_policy', {
          bucket_name: 'audio',
          policy_name: 'Allow individual user access - DELETE',
          operation: 'DELETE', 
          definition: "(bucket_id = 'audio' AND path LIKE auth.uid() || '/%')"
        });
        
        console.log('Audio bucket policies created successfully');
        return true;
      } catch (policyError: any) {
        console.error('Error creating policies:', policyError);
        return false;
      }
    }
    
    return true;
  } catch (error: any) {
    console.error('Error setting up policies:', error);
    return false;
  }
}
