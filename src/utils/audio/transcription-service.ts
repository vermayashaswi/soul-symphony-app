
import { supabase } from '@/integrations/supabase/client';
import { blobToBase64, validatePayloadSize, getUtf8ByteLength, validateAudioBlob, testBlobProcessing } from './blob-utils';

/**
 * Enhanced transcription service with comprehensive error handling and request validation
 */
export async function transcribeAudio(
  audioBlob: Blob,
  userId: string
): Promise<{
  success: boolean;
  entryId?: number;
  transcription?: string;
  refinedText?: string;
  error?: string;
  debugInfo?: any;
}> {
  const debugInfo = {
    stage: 'initialization',
    timestamp: Date.now(),
    blobInfo: null,
    requestInfo: null,
    sessionInfo: null,
    errorDetails: null
  };

  try {
    console.log('[TranscriptionService] Starting enhanced transcription process');
    debugInfo.stage = 'blob_validation';
    
    // Stage 1: Comprehensive blob validation
    console.log('[TranscriptionService] Stage 1: Validating audio blob...');
    const blobValidation = validateAudioBlob(audioBlob);
    debugInfo.blobInfo = {
      validation: blobValidation,
      size: audioBlob.size,
      type: audioBlob.type,
      constructor: audioBlob.constructor.name
    };

    if (!blobValidation.isValid) {
      throw new Error(`Blob validation failed: ${blobValidation.errorMessage}`);
    }

    // Stage 2: Test the complete blob processing pipeline
    console.log('[TranscriptionService] Stage 2: Testing blob processing pipeline...');
    debugInfo.stage = 'pipeline_test';
    
    const pipelineTest = await testBlobProcessing(audioBlob);
    debugInfo.blobInfo.pipelineTest = pipelineTest;
    
    if (!pipelineTest.success) {
      throw new Error(`Pipeline test failed: ${pipelineTest.error}`);
    }

    // Stage 3: Convert blob to base64 with enhanced error handling
    console.log('[TranscriptionService] Stage 3: Converting blob to base64...');
    debugInfo.stage = 'base64_conversion';
    
    let dataUrl: string;
    const conversionStartTime = Date.now();
    
    try {
      dataUrl = await blobToBase64(audioBlob);
      const conversionTime = Date.now() - conversionStartTime;
      
      console.log('[TranscriptionService] Base64 conversion completed:', {
        dataUrlLength: dataUrl.length,
        conversionTime,
        blobSize: audioBlob.size,
        compressionRatio: (dataUrl.length / audioBlob.size).toFixed(2)
      });
    } catch (conversionError) {
      console.error('[TranscriptionService] Base64 conversion failed:', conversionError);
      debugInfo.errorDetails = {
        stage: 'base64_conversion',
        error: conversionError.message,
        blobSize: audioBlob.size,
        blobType: audioBlob.type
      };
      throw new Error(`Base64 conversion failed: ${conversionError.message}`);
    }

    // Stage 4: Validate the converted data URL
    console.log('[TranscriptionService] Stage 4: Validating data URL...');
    debugInfo.stage = 'dataurl_validation';
    
    if (!dataUrl.startsWith('data:')) {
      throw new Error('Invalid data URL: missing data: prefix');
    }
    
    if (!dataUrl.includes('base64,')) {
      throw new Error('Invalid data URL: missing base64 marker');
    }

    const base64Part = dataUrl.split('base64,')[1];
    if (!base64Part || base64Part.length < 100) {
      throw new Error('Invalid data URL: base64 content too short');
    }

    // Stage 5: Prepare and validate payload
    console.log('[TranscriptionService] Stage 5: Preparing request payload...');
    debugInfo.stage = 'payload_preparation';
    
    let recordingTime = 0;
    if ('duration' in audioBlob) {
      recordingTime = Math.round((audioBlob as any).duration * 1000);
    }
    
    const payload = {
      audio: dataUrl,
      userId,
      recordingTime,
      highQuality: true,
      timestamp: Date.now(),
      clientInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };
    
    // Validate payload size with detailed breakdown
    const sizeValidation = validatePayloadSize(payload);
    debugInfo.requestInfo = {
      payloadValidation: sizeValidation,
      recordingTime,
      audioDataLength: dataUrl.length,
      clientInfo: payload.clientInfo
    };
    
    console.log('[TranscriptionService] Payload validation result:', sizeValidation);
    
    if (!sizeValidation.isValid) {
      throw new Error(`Payload validation failed: ${sizeValidation.errorMessage}`);
    }

    // Stage 6: Validate session and authentication
    console.log('[TranscriptionService] Stage 6: Validating authentication...');
    debugInfo.stage = 'session_validation';
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    debugInfo.sessionInfo = {
      hasSession: !!session,
      hasAccessToken: !!(session?.access_token),
      sessionError: sessionError?.message,
      userId: session?.user?.id
    };
    
    if (sessionError) {
      console.error('[TranscriptionService] Session error:', sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }
    
    if (!session?.access_token) {
      throw new Error('No valid session found - please log in again');
    }

    if (session.user?.id !== userId) {
      throw new Error('User ID mismatch - session user does not match request user');
    }

    // Stage 7: Calculate and validate content length
    console.log('[TranscriptionService] Stage 7: Calculating content length...');
    debugInfo.stage = 'content_length_calculation';
    
    const payloadString = JSON.stringify(payload);
    const contentLength = getUtf8ByteLength(payloadString);
    
    console.log('[TranscriptionService] Content length calculation:', {
      payloadStringLength: payloadString.length,
      utf8ByteLength: contentLength,
      sizeMB: (contentLength / (1024 * 1024)).toFixed(2)
    });

    if (contentLength === 0) {
      throw new Error('Calculated content length is 0 - payload serialization failed');
    }

    // Stage 8: Prepare request headers with explicit content length
    console.log('[TranscriptionService] Stage 8: Preparing request headers...');
    debugInfo.stage = 'request_preparation';
    
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': contentLength.toString(),
      'Authorization': `Bearer ${session.access_token}`,
      'X-Client-Info': 'supabase-js-web/2.49.1',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    };

    console.log('[TranscriptionService] Request headers prepared:', {
      contentType: requestHeaders['Content-Type'],
      contentLength: requestHeaders['Content-Length'],
      hasAuth: !!requestHeaders['Authorization'],
      clientInfo: requestHeaders['X-Client-Info']
    });

    // Stage 9: Make the API request with enhanced error handling
    console.log('[TranscriptionService] Stage 9: Invoking edge function...');
    debugInfo.stage = 'api_request';
    
    const requestStartTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: payload,
        headers: requestHeaders
      });
      
      const requestTime = Date.now() - requestStartTime;
      
      console.log('[TranscriptionService] Edge function response received:', {
        requestTimeMs: requestTime,
        hasData: !!data,
        hasError: !!error,
        errorMessage: error?.message,
        dataKeys: data ? Object.keys(data) : []
      });

      debugInfo.requestInfo.response = {
        requestTime,
        hasData: !!data,
        hasError: !!error,
        errorMessage: error?.message,
        success: !!data && !error
      };

      if (error) {
        console.error('[TranscriptionService] Edge function error:', error);
        debugInfo.errorDetails = {
          stage: 'api_request',
          error: error.message,
          details: error
        };
        throw new Error(`Server error: ${error.message || 'Unknown error from transcription service'}`);
      }

      if (!data) {
        console.error('[TranscriptionService] No data returned from edge function');
        debugInfo.errorDetails = {
          stage: 'api_request',
          error: 'No response data',
          details: 'Edge function returned null/undefined data'
        };
        throw new Error('No response from transcription service');
      }

      // Stage 10: Validate response data
      console.log('[TranscriptionService] Stage 10: Validating response...');
      debugInfo.stage = 'response_validation';
      
      if (!data.entryId) {
        throw new Error('Response missing entryId');
      }

      if (!data.transcription && !data.refinedText) {
        throw new Error('Response missing transcription data');
      }

      console.log('[TranscriptionService] Transcription completed successfully:', {
        entryId: data.entryId,
        hasTranscription: !!data.transcription,
        hasRefinedText: !!data.refinedText,
        processingTime: data.processingTime,
        totalTime: Date.now() - debugInfo.timestamp
      });

      return {
        success: true,
        entryId: data.entryId,
        transcription: data.transcription,
        refinedText: data.refinedText,
        debugInfo
      };

    } catch (apiError: any) {
      console.error('[TranscriptionService] API request failed:', apiError);
      debugInfo.errorDetails = {
        stage: 'api_request',
        error: apiError.message,
        details: apiError
      };
      throw apiError;
    }
    
  } catch (error: any) {
    console.error('[TranscriptionService] Error in transcription:', error);
    
    debugInfo.errorDetails = {
      ...debugInfo.errorDetails,
      finalError: error.message,
      stack: error.stack
    };

    // Provide user-friendly error messages based on the stage where error occurred
    let userFriendlyError = 'Failed to transcribe audio - please try again';
    
    switch (debugInfo.stage) {
      case 'blob_validation':
        userFriendlyError = 'Invalid audio data - please try recording again';
        break;
      case 'base64_conversion':
        userFriendlyError = 'Error processing audio format - please try recording again';
        break;
      case 'payload_preparation':
        if (error.message?.includes('too large')) {
          userFriendlyError = 'Audio file too large - please record a shorter message';
        } else {
          userFriendlyError = 'Error preparing audio data - please try again';
        }
        break;
      case 'session_validation':
        userFriendlyError = 'Session expired - please log in again';
        break;
      case 'api_request':
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          userFriendlyError = 'Network error - please check your connection';
        } else if (error.message?.includes('Server error')) {
          userFriendlyError = 'Server error - please try again in a moment';
        }
        break;
      default:
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          userFriendlyError = 'Network error - please check your connection';
        } else if (error.message?.includes('auth') || error.message?.includes('session')) {
          userFriendlyError = 'Session expired - please log in again';
        } else if (error.message?.includes('too large') || error.message?.includes('size')) {
          userFriendlyError = 'Audio file too large - please record a shorter message';
        }
    }
    
    return {
      success: false,
      error: userFriendlyError,
      debugInfo
    };
  }
}
