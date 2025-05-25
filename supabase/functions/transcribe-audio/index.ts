
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  transcribeAudioWithWhisper, 
  translateAndRefineText, 
  analyzeEmotions,
  generateEmbedding 
} from './aiProcessing.ts';
import { storeJournalEntry, extractThemes } from './databaseOperations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { audio, userId, directTranscription, highQuality, recordingTime } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    // Get environment variables
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Convert base64 audio to blob
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const audioBlob = new Blob([binaryAudio], { type: 'audio/wav' });
    
    console.log('[Transcription] Using filename: audio.wav');

    // Transcribe audio using Whisper
    const { text: transcribedText, detectedLanguages } = await transcribeAudioWithWhisper(
      audioBlob,
      'wav',
      openAiApiKey,
      'auto'
    );

    console.log('Transcription successful:', !!transcribedText);
    console.log('Detected languages:', detectedLanguages);

    // If direct transcription is requested, return immediately
    if (directTranscription) {
      return new Response(JSON.stringify({
        transcribedText,
        detectedLanguages
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process transcription with GPT for refinement...
    console.log('Processing transcription with GPT for refinement...');
    
    // Pass the recording time to the refinement function for quality checking
    const { refinedText } = await translateAndRefineText(
      transcribedText, 
      openAiApiKey, 
      detectedLanguages,
      recordingTime || 0
    );

    // Get emotions data from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: emotionsData, error: emotionsError } = await supabase
      .from('emotions')
      .select('name, description');

    if (emotionsError) {
      console.error('Error fetching emotions:', emotionsError);
      throw new Error('Failed to fetch emotions data');
    }

    // Analyze emotions
    const emotions = await analyzeEmotions(refinedText, emotionsData || [], openAiApiKey);

    // Analyze sentiment using Google Natural Language API (existing logic)
    const googleApiKey = Deno.env.get('GOOGLE_NL_API_KEY');
    let sentiment = "0";
    
    if (googleApiKey && googleApiKey.startsWith('AIza') && googleApiKey.length > 30) {
      try {
        console.log('Analyzing text with Google NL API for sentiment:', refinedText.substring(0, 50) + "...");
        
        const nlResponse = await fetch(`https://language.googleapis.com/v1/documents:analyzeSentiment?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document: {
              type: 'PLAIN_TEXT',
              content: refinedText,
              language: detectedLanguages[0] === 'unknown' ? 'en' : detectedLanguages[0]
            },
            encodingType: 'UTF8'
          })
        });

        if (nlResponse.ok) {
          const nlResult = await nlResponse.json();
          sentiment = nlResult.documentSentiment?.score?.toString() || "0";
        } else {
          console.error('Google NL API error:', await nlResponse.text());
        }
      } catch (error) {
        console.error('Error analyzing sentiment:', error);
      }
    } else {
      console.error('Google NL API key appears to be invalid:', googleApiKey ? googleApiKey.substring(0, 5) + '...' : 'not set');
    }

    // Calculate audio duration
    const calculatedDuration = Math.max(1, Math.floor(audioBlob.size / 16000));
    console.log('Calculated audio duration:', calculatedDuration, 'seconds');

    // Store journal entry
    console.log('Storing journal entry...');
    
    // Upload audio to Supabase Storage
    const audioFileName = `journal-entry-${userId}-${Date.now()}.wav`;
    const { error: uploadError } = await supabase.storage
      .from('journal-audio')
      .upload(audioFileName, audioBlob, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      throw new Error('Failed to upload audio file');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('journal-audio')
      .getPublicUrl(audioFileName);

    const entryId = await storeJournalEntry(
      supabase,
      transcribedText,
      refinedText,
      publicUrl,
      userId,
      calculatedDuration,
      emotions,
      sentiment
    );

    console.log('Journal entry stored with ID:', entryId);

    // Verify entry in database
    const { data: verificationData } = await supabase
      .from('Journal Entries')
      .select('id')
      .eq('id', entryId)
      .single();

    if (verificationData) {
      console.log('Entry verified in database:', entryId);
    }

    // Extract themes (existing logic)
    await extractThemes(supabase, refinedText, entryId);
    console.log('Themes extracted successfully');

    // Generate and store embedding
    try {
      console.log('[AI] Generating embedding for text:', refinedText.substring(0, 50) + "....");
      const embedding = await generateEmbedding(refinedText, openAiApiKey);
      
      // Store embedding in database
      try {
        const { error: embeddingError } = await supabase
          .from('journal_embeddings')
          .insert({
            journal_entry_id: entryId,
            content: refinedText,
            embedding: JSON.stringify(embedding)
          });
        
        if (embeddingError) {
          console.error('Error storing embedding:', embeddingError);
        }
      } catch (error) {
        console.error('Error in storeEmbedding:', error);
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
    }

    console.log('Theme generation triggered successfully');

    return new Response(JSON.stringify({
      entryId,
      transcribedText,
      refinedText,
      audioUrl: publicUrl,
      duration: calculatedDuration,
      emotions,
      sentiment,
      themes: [],
      detectedLanguages
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
