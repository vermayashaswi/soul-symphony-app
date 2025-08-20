
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { transcribeAudioWithWhisper } from './aiProcessing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { audio, recordingTime, originalFormat, finalFormat, originalSize, paddedSize, hasPadding } = await req.json();

    if (!audio) {
      return new Response(JSON.stringify({ error: 'No audio data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[ChatTranscription] Starting chat-only transcription for user:', user.id);
    console.log('[ChatTranscription] Audio format info:', {
      originalFormat,
      finalFormat,
      originalSize,
      paddedSize,
      hasPadding,
      audioDataLength: audio.length
    });

    // Convert base64 to binary
    const audioBytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    
    // Determine the correct MIME type and file extension from format info
    let audioType = finalFormat || originalFormat || 'audio/webm';
    let fileExtension = 'webm';
    
    // Extract format from MIME type or use passed format
    if (audioType.includes('wav')) {
      audioType = 'audio/wav';
      fileExtension = 'wav';
    } else if (audioType.includes('webm')) {
      audioType = 'audio/webm';
      fileExtension = 'webm';
    } else if (audioType.includes('mp4') || audioType.includes('m4a')) {
      audioType = 'audio/mp4';
      fileExtension = 'm4a';
    } else if (audioType.includes('ogg')) {
      audioType = 'audio/ogg';
      fileExtension = 'ogg';
    }
    
    const audioBlob = new Blob([audioBytes], { type: audioType });
    
    console.log('[ChatTranscription] Audio blob created with detected format:', {
      detectedType: audioType,
      fileExtension,
      size: audioBlob.size,
      type: audioBlob.type,
      recordingTime
    });

    console.log('[ChatTranscription] Audio blob created:', {
      size: audioBlob.size,
      type: audioBlob.type,
      recordingTime
    });

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Transcribe audio only - no journal entry creation
    const transcriptionResult = await transcribeAudioWithWhisper(
      audioBlob,
      fileExtension,
      openaiApiKey,
      'auto'
    );

    const transcribedText = transcriptionResult.text;

    if (!transcribedText || transcribedText.trim().length === 0) {
      throw new Error('Transcription returned empty result');
    }

    console.log('[ChatTranscription] Transcription successful:', {
      textLength: transcribedText.length,
      sampleText: transcribedText.substring(0, 100) + "..."
    });

    // Return only the transcription - no database storage
    return new Response(JSON.stringify({
      success: true,
      transcription: transcribedText,
      recordingTime: recordingTime || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[ChatTranscription] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Transcription failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
