
import { supabase } from '@/integrations/supabase/client';

interface TranscriptionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Sends audio data to the transcribe-audio edge function
 * @param base64Audio - Base64 encoded audio data
 * @param userId - User ID for association with the transcription
 * @param directTranscription - If true, just returns the transcription without processing
 */
export async function sendAudioForTranscription(
  base64Audio: string,
  userId: string | undefined,
  directTranscription: boolean = false
): Promise<TranscriptionResult> {
  try {
    if (!base64Audio) {
      throw new Error('No audio data provided');
    }

    console.log(`Sending audio for ${directTranscription ? 'direct' : 'full'} transcription processing`);
    console.log(`Audio data size: ${base64Audio.length} characters`);
    
    // Check if the user is authenticated
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error('Authentication check failed:', authError);
      return {
        success: false,
        error: 'User authentication error. Please sign in again.'
      };
    }
    console.log('User authenticated:', authData.user.id);
    
    // Pre-check if we can access the Journal Entries table
    try {
      const { error: tableCheckError } = await supabase
        .from('Journal Entries')
        .select('id')
        .limit(1);
        
      if (tableCheckError) {
        console.error('Table access check failed:', tableCheckError);
        return {
          success: false,
          error: `Cannot access Journal Entries table: ${tableCheckError.message}`
        };
      }
      console.log('Successfully verified database table access');
    } catch (tableError) {
      console.error('Error checking table access:', tableError);
    }
    
    // Call the Supabase edge function with a longer timeout
    console.log('Calling transcribe-audio edge function...');
    const response = await supabase.functions.invoke('transcribe-audio', {
      body: {
        audio: base64Audio,
        userId: userId || authData.user.id, // Use current user ID as fallback
        directTranscription: directTranscription,
        highQuality: true // Add flag to indicate this is a high-quality recording
      }
    });

    // Handle response errors
    if (response.error) {
      console.error('Edge function error:', response.error);
      return {
        success: false,
        error: response.error?.message || 'Failed to process audio'
      };
    }

    // Log detailed response for debugging
    console.log('Edge function response:', JSON.stringify({
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : 'no data',
      successStatus: response.data?.success
    }));

    // Check if the response has a success field
    if (response.data?.success === false) {
      console.error('Processing error:', response.data.error || response.data.message);
      return {
        success: false,
        error: response.data.error || response.data.message || 'Unknown error in audio processing'
      };
    }

    // Validate that we have data back
    if (!response.data) {
      console.error('No data returned from edge function');
      return {
        success: false,
        error: 'No data returned from server'
      };
    }

    console.log('Transcription successful:', {
      directMode: directTranscription,
      transcriptionLength: response.data?.transcription?.length || 0,
      hasEntryId: !!response.data?.entryId,
      entryId: response.data?.entryId
    });

    // If we have an entry ID, verify it was actually created in the database
    if (response.data?.entryId) {
      try {
        const { data: entryCheckData, error: entryCheckError } = await supabase
          .from('Journal Entries')
          .select('id')
          .eq('id', response.data.entryId)
          .single();
          
        if (entryCheckError) {
          console.error('Entry verification failed:', entryCheckError);
        } else if (entryCheckData) {
          console.log('Successfully verified entry in database:', entryCheckData.id);
        } else {
          console.error('Entry not found in database despite successful function call');
        }
      } catch (verifyError) {
        console.error('Error verifying entry creation:', verifyError);
      }
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('Error in sendAudioForTranscription:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}
