
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Performs a comprehensive check of Supabase services needed for the journal functionality
 */
export async function diagnoseDatabaseIssues() {
  const results = {
    database: false,
    auth: false,
    storage: false,
    edgeFunctions: false,
    journalTable: false,
    embeddingsTable: false,
    audioBucket: false,
    errorDetails: [] as string[],
  };

  try {
    // Test basic database connectivity
    const { data: dbData, error: dbError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    results.database = !dbError;
    if (dbError) {
      results.errorDetails.push(`Database: ${dbError.message}`);
    }

    // Test auth service
    const { data: authData, error: authError } = await supabase.auth.getSession();
    results.auth = !authError;
    if (authError) {
      results.errorDetails.push(`Auth: ${authError.message}`);
    }

    // Test storage
    const { data: storageData, error: storageError } = await supabase.storage.listBuckets();
    results.storage = !storageError;
    if (storageError) {
      results.errorDetails.push(`Storage: ${storageError.message}`);
    } else {
      // Check if audio bucket exists
      const audioBucket = storageData?.find(bucket => bucket.name === 'audio');
      results.audioBucket = !!audioBucket;
      if (!audioBucket) {
        results.errorDetails.push('Storage: Audio bucket does not exist');
      }
    }

    // Test journal entries table
    const { data: journalData, error: journalError } = await supabase
      .from('Journal Entries')
      .select('id')
      .limit(1);
    
    results.journalTable = !journalError;
    if (journalError) {
      results.errorDetails.push(`Journal table: ${journalError.message}`);
    }

    // Test embeddings table
    const { data: embeddingsData, error: embeddingsError } = await supabase
      .from('journal_embeddings')
      .select('id')
      .limit(1);
    
    results.embeddingsTable = !embeddingsError;
    if (embeddingsError) {
      results.errorDetails.push(`Embeddings table: ${embeddingsError.message}`);
    }

    // Test edge functions
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
        body: { test: true }
      });
      
      results.edgeFunctions = !fnError;
      if (fnError) {
        results.errorDetails.push(`Edge functions: ${fnError.message}`);
      }
    } catch (edgeFnError: any) {
      results.edgeFunctions = false;
      results.errorDetails.push(`Edge functions exception: ${edgeFnError.message}`);
    }

    return {
      success: results.database && results.journalTable && results.audioBucket,
      results,
      isClientSideIssue: !results.database || !results.auth,
      isServerSideIssue: results.database && results.auth && 
                        (!results.journalTable || !results.storage || 
                         !results.edgeFunctions || !results.audioBucket),
      errorDetails: results.errorDetails
    };
  } catch (error: any) {
    return {
      success: false,
      results,
      isClientSideIssue: true,
      isServerSideIssue: false,
      errorDetails: [`Unhandled error: ${error.message}`]
    };
  }
}

/**
 * Creates the audio bucket if it doesn't exist
 */
export async function createAudioBucket() {
  try {
    // First check if the audio bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      toast.error('Unable to check storage buckets');
      return { success: false, error: bucketsError.message };
    }
    
    const audioBucket = buckets?.find(bucket => bucket.name === 'audio');
    
    if (!audioBucket) {
      toast.info('Audio bucket not found, attempting to create...');
      
      try {
        const { data, error } = await supabase.storage.createBucket('audio', {
          public: true, // Make bucket public
          fileSizeLimit: 52428800, // 50MB
        });
        
        if (error) {
          toast.error(`Failed to create audio bucket: ${error.message}`);
          return { success: false, error: error.message };
        }
        
        toast.success('Audio bucket created successfully');
        return { success: true, message: 'Audio bucket created' };
      } catch (createError: any) {
        toast.error(`Error creating bucket: ${createError.message}`);
        return { success: false, error: createError.message };
      }
    }
    
    toast.success('Audio bucket exists');
    return { success: true, message: 'Audio bucket already exists' };
  } catch (error: any) {
    toast.error('Error checking/creating storage');
    return { success: false, error: error.message };
  }
}

/**
 * Checks if there are any journal entries for the current user
 */
export async function checkUserJournalEntries(userId: string | undefined) {
  if (!userId) {
    return { success: false, error: 'No user ID provided' };
  }
  
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) {
      return { success: false, error: error.message, entries: [] };
    }
    
    return { 
      success: true, 
      entries: data || [],
      hasEntries: data && data.length > 0,
      count: data?.length || 0
    };
  } catch (error: any) {
    return { success: false, error: error.message, entries: [] };
  }
}
