
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { analyzeWithGoogleNL } from './nlProcessing.ts';
import { transcribeAudioWithWhisper, translateAndRefineText, analyzeEmotions, generateEmbedding } from './aiProcessing.ts';
import { createSupabaseAdmin, createProfileIfNeeded, extractThemes, storeJournalEntry, storeEmbedding } from './databaseOperations.ts';
import { storeAudioFile } from './storageOperations.ts';
import { processBase64Chunks, detectFileType, validateAndFixAudioData } from './audioProcessing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Environment check: {");
    console.log(`  hasOpenAIKey: ${!!Deno.env.get('OPENAI_API_KEY')},`);
    console.log(`  hasSupabaseUrl: ${!!Deno.env.get('SUPABASE_URL')},`);
    console.log(`  hasSupabaseServiceKey: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')},`);
    console.log(`  hasGoogleNLApiKey: ${!!Deno.env.get('GOOGLE_API')}`);
    console.log("}");

    // Validate required environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found');
    }

    // Create admin client for database operations
    const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseServiceKey);
    
    // Create client with user's auth for RLS compliance
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    console.log("Supabase clients initialized successfully");

    // Parse request body and handle parameter mapping
    const { audio, audioData, userId, highQuality = true, directTranscription = false, recordingTime = 0 } = await req.json();
    
    // Handle both parameter names for backward compatibility
    const actualAudioData = audio || audioData;
    
    console.log("Received audio data, processing...");
    console.log(`User ID: ${userId}`);
    console.log(`Direct transcription mode: ${directTranscription ? 'YES' : 'NO'}`);
    console.log(`High quality mode: ${highQuality ? 'YES' : 'NO'}`);
    console.log(`Audio data length: ${actualAudioData?.length || 0}`);
    console.log(`Recording time (client-provided): ${recordingTime}ms`);
    
    if (!actualAudioData) {
      throw new Error('No audio data received');
    }

    if (!userId) {
      throw new Error('User ID is required for authentication');
    }

    // Get timezone from request headers if available
    const timezone = req.headers.get('x-timezone') || 'UTC';
    
    // Create user profile if needed and update timezone
    await createProfileIfNeeded(supabaseAdmin, userId, timezone);

    // Convert base64 to binary using the improved processing function
    console.log('Processing base64 audio data...');
    const bytes = processBase64Chunks(actualAudioData);
    console.log(`Processed binary audio size: ${bytes.length} bytes`);

    // Detect file type using binary analysis
    const detectedFileType = detectFileType(bytes);
    console.log(`Detected file type: ${detectedFileType}`);

    // Validate and fix audio data
    const validatedBytes = validateAndFixAudioData(bytes, detectedFileType);
    console.log(`Audio validation completed`);

    // FIXED: Use the client-provided recording time directly
    const durationMs = recordingTime > 0 ? recordingTime : 0;
    console.log(`Using actual recording duration: ${durationMs}ms (source: ${recordingTime > 0 ? 'client' : 'fallback'})`);

    // Store audio file using admin client
    const timestamp = Date.now();
    const fileName = `journal-entry-${userId}-${timestamp}.${detectedFileType}`;
    
    console.log(`Storing audio file ${fileName} with size ${validatedBytes.length} bytes`);
    
    const audioUrl = await storeAudioFile(supabaseAdmin, validatedBytes, fileName, detectedFileType);
    
    if (!audioUrl) {
      console.warn('Failed to store audio file, continuing without URL');
    } else {
      console.log(`File uploaded successfully: ${audioUrl}`);
    }

    // Create blob for transcription
    const audioBlob = new Blob([validatedBytes], { type: `audio/${detectedFileType}` });
    console.log(`Created blob for transcription: { size: ${audioBlob.size}, type: "${audioBlob.type}", detectedFileType: "${detectedFileType}" }`);

    // Step 1: Transcribe audio using the enhanced Whisper function
    console.log('Step 1: Transcribing audio with enhanced Whisper API...');
    const { text: transcribedText, detectedLanguages } = await transcribeAudioWithWhisper(
      audioBlob,
      detectedFileType,
      openaiApiKey,
      'auto' // Always use auto-detection for better language detection
    );

    if (!transcribedText || transcribedText.trim().length === 0) {
      throw new Error('Transcription returned empty result');
    }

    console.log(`Transcription successful: ${transcribedText.length} characters`);
    console.log(`Sample: "${transcribedText.slice(0, 50)}${transcribedText.length > 50 ? '...' : ''}"`);
    console.log(`Detected languages: ${JSON.stringify(detectedLanguages)}`);

    // If direct transcription mode, return the result immediately
    if (directTranscription) {
      console.log('Direct transcription mode, returning result immediately');
      return new Response(JSON.stringify({
        transcription: transcribedText,
        language: detectedLanguages[0] || 'unknown',
        languages: detectedLanguages,
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Translate and refine text using the enhanced function
    console.log('Step 2: Translating and refining text with enhanced processing...');
    const { refinedText } = await translateAndRefineText(transcribedText, openaiApiKey, detectedLanguages);

    console.log('Text refinement completed');
    console.log(`Original length: ${transcribedText.length}, Refined length: ${refinedText.length}`);
    console.log(`Refined sample: "${refinedText.slice(0, 50)}${refinedText.length > 50 ? '...' : ''}"`);

    // Step 3: Analyze sentiment with Google NL API (with enhanced error handling)
    console.log('Step 3: Analyzing sentiment with Google NL API...');
    const googleNLApiKey = Deno.env.get('GOOGLE_API');
    
    let sentimentResult = { sentiment: "0" };
    
    if (googleNLApiKey) {
      try {
        sentimentResult = await analyzeWithGoogleNL(refinedText, googleNLApiKey);
        console.log(`Sentiment analysis result: ${sentimentResult.sentiment}`);
      } catch (sentimentError) {
        console.error('Error analyzing sentiment:', sentimentError);
        console.log('Continuing with default sentiment value of 0');
      }
    } else {
      console.warn('Google NL API key not found, skipping sentiment analysis');
    }

    // Step 4: Enhanced emotion analysis
    console.log('Step 4: Analyzing emotions with enhanced processing...');
    
    // Fetch emotions from database
    const { data: emotionsData, error: emotionsError } = await supabaseAdmin
      .from('emotions')
      .select('name, description');

    let emotions = {};
    if (!emotionsError && emotionsData && emotionsData.length > 0) {
      try {
        emotions = await analyzeEmotions(refinedText, emotionsData, openaiApiKey);
        console.log('Emotion analysis completed:', emotions);
      } catch (emotionError) {
        console.error('Error analyzing emotions:', emotionError);
        console.log('Continuing with empty emotions');
      }
    } else {
      console.warn('No emotions data found in database, skipping emotion analysis');
    }

    // Step 5: Store in database using the enhanced function (without separate entity extraction)
    console.log('Step 5: Storing journal entry in database...');
    
    const entryId = await storeJournalEntry(
      supabaseAdmin,
      transcribedText,
      refinedText,
      audioUrl,
      userId,
      durationMs, // Use the actual recording duration
      emotions,
      sentimentResult.sentiment
    );

    console.log(`Journal entry stored successfully with ID: ${entryId}`);

    // Step 6: Update with enhanced language detection results
    console.log('Step 6: Updating entry with detected languages...');
    const { error: languageUpdateError } = await supabaseAdmin
      .from('Journal Entries')
      .update({ languages: detectedLanguages })
      .eq('id', entryId);

    if (languageUpdateError) {
      console.error('Error updating languages:', languageUpdateError);
    } else {
      console.log(`Languages updated: ${JSON.stringify(detectedLanguages)}`);
    }

    // Step 7: Extract themes, entities, and categories using the unified generate-themes function
    console.log('Step 7: Extracting themes, entities, and categories with unified processing...');
    await extractThemes(supabaseAdmin, refinedText, entryId);

    // Step 8: Generate and store embeddings with enhanced error handling
    console.log('Step 8: Generating embeddings with enhanced processing...');
    try {
      const embedding = await generateEmbedding(refinedText, openaiApiKey);
      await storeEmbedding(supabaseAdmin, entryId, refinedText, embedding);
      console.log('Embeddings generated and stored successfully');
    } catch (embeddingError) {
      console.error('Error with embeddings:', embeddingError);
      // Continue without embeddings - don't fail the entire process
    }

    // Return enhanced success response
    console.log('Processing complete, returning enhanced success response');
    
    return new Response(JSON.stringify({
      id: entryId,
      entryId: entryId,
      transcription: transcribedText,
      refined: refinedText,
      emotions: emotions,
      sentiment: sentimentResult.sentiment,
      language: detectedLanguages[0] || 'unknown',
      languages: detectedLanguages,
      duration: durationMs, // Return the actual recording duration
      audioUrl: audioUrl,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in enhanced transcribe-audio function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
