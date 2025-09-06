import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[ProcessProfileAudio] Starting profile audio processing...');
    
    const { audio_data, user_id } = await req.json();
    
    if (!audio_data || !user_id) {
      console.error('[ProcessProfileAudio] Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing audio_data or user_id' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('[ProcessProfileAudio] Missing OpenAI API key');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ProcessProfileAudio] Step 1: Transcribing audio...');

    // Step 1: Transcribe the audio using OpenAI Whisper
    const transcriptionFormData = new FormData();
    
    // Convert base64 to blob
    const audioBuffer = Uint8Array.from(atob(audio_data), c => c.charCodeAt(0));
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    
    transcriptionFormData.append('file', audioBlob, 'audio.webm');
    transcriptionFormData.append('model', 'whisper-1');
    // Language auto-detection is default when no language parameter is provided

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: transcriptionFormData,
    });

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.text();
      console.error('[ProcessProfileAudio] Transcription failed:', error);
      throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    const transcribedText = transcriptionData.text;
    
    console.log('[ProcessProfileAudio] Transcription completed. Length:', transcribedText.length);

    // Step 2: Extract profile information using GPT-4.1-mini
    console.log('[ProcessProfileAudio] Step 2: Extracting profile information...');
    
    const extractionPrompt = `
You are a helpful assistant that extracts personal information from transcribed user recordings. 
The user has provided details about themselves for profile creation.

Please analyze the following transcribed text and extract meaningful data. Return ONLY a valid JSON object with these fields:

{
  "age": number | null,
  "interests": string[] | null,
  "gender": string | null,
  "place": string | null,
  "profession": string | null,
  "hobbies": string[] | null,
  "likes": string[] | null,
  "dislikes": string[] | null,
  "others": string | null
}

Guidelines:
- Extract only information that is clearly mentioned
- Convert ages to numbers
- Use arrays for multiple items (interests, hobbies, likes, dislikes)
- Use null for missing information
- For "others", include any additional personality traits, background, or context that doesn't fit other categories
- Keep extracted text concise but meaningful
- If gender is mentioned in non-standard terms, use the exact term provided by the user

Transcribed text: "${transcribedText}"

Return only the JSON object:`;

    const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that extracts structured data from user input.' },
          { role: 'user', content: extractionPrompt }
        ],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });

    if (!extractionResponse.ok) {
      const error = await extractionResponse.text();
      console.error('[ProcessProfileAudio] Extraction failed:', error);
      throw new Error(`Profile extraction failed: ${extractionResponse.status}`);
    }

    const extractionData = await extractionResponse.json();
    const extractedProfile = JSON.parse(extractionData.choices[0].message.content);
    
    console.log('[ProcessProfileAudio] Extracted profile data:', extractedProfile);

    // Step 3: Update the user's profile in the database
    console.log('[ProcessProfileAudio] Step 3: Updating user profile...');
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        age: extractedProfile.age,
        interests: extractedProfile.interests,
        gender: extractedProfile.gender,
        place: extractedProfile.place,
        profession: extractedProfile.profession,
        hobbies: extractedProfile.hobbies,
        likes: extractedProfile.likes,
        dislikes: extractedProfile.dislikes,
        others: extractedProfile.others,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) {
      console.error('[ProcessProfileAudio] Database update failed:', updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('[ProcessProfileAudio] Profile successfully updated for user:', user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcription: transcribedText,
        extracted_data: extractedProfile 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[ProcessProfileAudio] Error processing profile audio:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: 'Failed to process profile audio recording'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});