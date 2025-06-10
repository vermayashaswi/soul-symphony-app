
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { analyzeWithGoogleNL } from './nlProcessing.ts';
import { transcribeAudioWithWhisper, translateAndRefineText, analyzeEmotions, generateEmbedding } from './aiProcessing.ts';
import { createSupabaseAdmin, createProfileIfNeeded, extractThemes, storeJournalEntry, storeEmbedding } from './databaseOperations.ts';
import { storeAudioFile } from './storageOperations.ts';
import { processBase64Chunks, detectFileType, isValidAudioData } from './audioProcessing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-timezone, x-request-timestamp',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== FIXED TRANSCRIBE-AUDIO PIPELINE START ===");
    console.log("Environment check: {");
    console.log(`  hasOpenAIKey: ${!!Deno.env.get('OPENAI_API_KEY')},`);
    console.log(`  hasSupabaseUrl: ${!!Deno.env.get('SUPABASE_URL')},`);
    console.log(`  hasSupabaseServiceKey: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')},`);
    console.log(`  hasGoogleNLApiKey: ${!!Deno.env.get('GOOGLE_API')}`);
    console.log("}");

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    // Create admin client for database operations
    const supabaseAdmin = createSupabaseAdmin(supabaseUrl, supabaseServiceKey);
    
    // Create client with user's auth for RLS compliance
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    console.log("FIXED: Supabase clients initialized successfully");

    // Parse request parameters with enhanced logging
    const { audio, audioData, userId, highQuality = true, directTranscription = false, recordingTime = null } = await req.json();
    
    // Handle both parameter names for backward compatibility
    const actualAudioData = audio || audioData;
    
    console.log("=== FIXED REQUEST PARAMETERS ===");
    console.log(`User ID: ${userId}`);
    console.log(`Direct transcription mode: ${directTranscription ? 'YES' : 'NO'}`);
    console.log(`High quality mode: ${highQuality ? 'YES' : 'NO'}`);
    console.log(`Audio data length: ${actualAudioData?.length || 0}`);
    console.log(`FIXED: Recording time received: ${recordingTime} (${typeof recordingTime})`);
    
    if (!actualAudioData) {
      throw new Error('No audio data received');
    }

    if (!userId) {
      throw new Error('User ID is required for authentication');
    }

    // Get timezone from request headers if available
    const timezone = req.headers.get('x-timezone') || 'UTC';
    const requestTimestamp = req.headers.get('x-request-timestamp') || new Date().toISOString();
    console.log(`FIXED: User timezone: ${timezone}, Request timestamp: ${requestTimestamp}`);
    
    // Create user profile if needed and update timezone
    await createProfileIfNeeded(supabaseAdmin, userId, timezone);

    // FIXED: Enhanced audio processing with proper chunking and validation
    console.log("=== FIXED AUDIO PROCESSING ===");
    const bytes = processBase64Chunks(actualAudioData);
    const detectedFileType = detectFileType(bytes);
    
    console.log(`FIXED: Processed binary audio size: ${bytes.length} bytes`);
    console.log(`FIXED: Detected file type: ${detectedFileType}`);

    // FIXED: Validate audio data before processing
    if (!isValidAudioData(bytes)) {
      throw new Error('Invalid audio data detected');
    }

    // FIXED: Proper duration calculation - use actual recording time if provided
    let durationSeconds: number;
    if (recordingTime !== null && recordingTime > 0) {
      // Convert milliseconds to seconds and round to nearest second
      durationSeconds = Math.round(recordingTime / 1000);
      console.log(`FIXED: Using provided recording duration: ${recordingTime}ms -> ${durationSeconds}s`);
    } else {
      // Fallback estimation based on audio data size
      durationSeconds = Math.floor(bytes.length / 32000); // Rough estimate for audio bitrate
      console.log(`FIXED: Estimated duration from audio size: ${durationSeconds}s`);
    }

    // Store audio file using admin client
    const timestamp = Date.now();
    const fileName = `journal-entry-${userId}-${timestamp}.${detectedFileType}`;
    
    console.log(`FIXED: Storing audio file ${fileName} with size ${bytes.length} bytes`);
    
    const audioUrl = await storeAudioFile(supabaseAdmin, bytes, fileName, detectedFileType);
    
    if (!audioUrl) {
      console.warn('FIXED: Failed to store audio file, continuing without URL');
    } else {
      console.log(`FIXED: File uploaded successfully: ${audioUrl}`);
    }

    // Create blob for transcription
    const audioBlob = new Blob([bytes], { type: `audio/${detectedFileType}` });
    console.log(`FIXED: Created blob for transcription: { size: ${audioBlob.size}, type: "${audioBlob.type}" }`);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found');
    }

    // Step 1: FIXED Enhanced transcription with better language detection
    console.log('=== FIXED STEP 1: ENHANCED AUDIO TRANSCRIPTION ===');
    const { text: transcribedText, detectedLanguages } = await transcribeAudioWithWhisper(
      audioBlob,
      detectedFileType,
      openaiApiKey,
      'auto' // Always use auto-detection for best results
    );

    if (!transcribedText || transcribedText.trim().length === 0) {
      throw new Error('Transcription returned empty result');
    }

    console.log(`FIXED: Transcription successful: ${transcribedText.length} characters`);
    console.log(`FIXED: Sample: "${transcribedText.slice(0, 100)}${transcribedText.length > 100 ? '...' : ''}"`);
    console.log(`FIXED: Enhanced detected languages: ${JSON.stringify(detectedLanguages)}`);

    // If direct transcription mode, return the result immediately with enhanced language info
    if (directTranscription) {
      console.log('FIXED: Direct transcription mode, returning enhanced result');
      return new Response(JSON.stringify({
        transcription: transcribedText,
        language: detectedLanguages[0] || 'unknown',
        languages: detectedLanguages,
        duration: durationSeconds,
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: FIXED Enhanced translation and refinement with proper language preservation
    console.log('=== FIXED STEP 2: ENHANCED TRANSLATION & REFINEMENT ===');
    const { refinedText, preservedLanguages } = await translateAndRefineText(
      transcribedText, 
      openaiApiKey, 
      detectedLanguages
    );

    console.log('FIXED: Enhanced text refinement completed');
    console.log(`FIXED: Original length: ${transcribedText.length}, Refined length: ${refinedText.length}`);
    console.log(`FIXED: Refined sample: "${refinedText.slice(0, 100)}${refinedText.length > 100 ? '...' : ''}"`);
    console.log(`FIXED: Enhanced preserved languages: ${JSON.stringify(preservedLanguages)}`);

    // FIXED: Use enhanced language preservation
    const finalLanguages = preservedLanguages && preservedLanguages.length > 0 ? preservedLanguages : detectedLanguages;
    console.log(`FIXED: Final languages for storage: ${JSON.stringify(finalLanguages)}`);

    // Step 3: FIXED Enhanced sentiment analysis
    console.log('=== FIXED STEP 3: ENHANCED SENTIMENT ANALYSIS ===');
    const googleNLApiKey = Deno.env.get('GOOGLE_API');
    
    let sentimentResult = { sentiment: "0" };
    
    if (googleNLApiKey) {
      try {
        sentimentResult = await analyzeWithGoogleNL(refinedText, googleNLApiKey);
        console.log(`FIXED: Enhanced sentiment analysis result: ${sentimentResult.sentiment}`);
      } catch (sentimentError) {
        console.error('FIXED: Error analyzing sentiment:', sentimentError);
        console.log('FIXED: Continuing with default sentiment value of 0');
      }
    } else {
      console.warn('FIXED: Google NL API key not found, skipping sentiment analysis');
    }

    // Step 4: FIXED Enhanced emotion analysis
    console.log('=== FIXED STEP 4: ENHANCED EMOTION ANALYSIS ===');
    
    // Fetch emotions from database
    const { data: emotionsData, error: emotionsError } = await supabaseAdmin
      .from('emotions')
      .select('name, description');

    let emotions = {};
    if (!emotionsError && emotionsData && emotionsData.length > 0) {
      try {
        emotions = await analyzeEmotions(refinedText, emotionsData, openaiApiKey);
        console.log('FIXED: Enhanced emotion analysis completed:', emotions);
      } catch (emotionError) {
        console.error('FIXED: Error analyzing emotions:', emotionError);
        console.log('FIXED: Continuing with empty emotions');
      }
    } else {
      console.warn('FIXED: No emotions data found in database, skipping emotion analysis');
    }

    // Step 5: FIXED Enhanced database storage with corrected duration
    console.log('=== FIXED STEP 5: ENHANCED DATABASE STORAGE ===');
    
    const entryId = await storeJournalEntry(
      supabaseAdmin,
      transcribedText,
      refinedText,
      audioUrl,
      userId,
      durationSeconds, // FIXED: Proper duration in seconds
      emotions,
      sentimentResult.sentiment
    );

    console.log(`FIXED: Journal entry stored successfully with ID: ${entryId}`);

    // Step 6: FIXED Enhanced language metadata update
    console.log('=== FIXED STEP 6: ENHANCED LANGUAGE METADATA UPDATE ===');
    const { error: languageUpdateError } = await supabaseAdmin
      .from('Journal Entries')
      .update({ 
        languages: finalLanguages,
        duration: durationSeconds // Ensure duration is properly set
      })
      .eq('id', entryId);

    if (languageUpdateError) {
      console.error('FIXED: Error updating languages and duration:', languageUpdateError);
    } else {
      console.log(`FIXED: Enhanced metadata updated: languages=${JSON.stringify(finalLanguages)}, duration=${durationSeconds}s`);
    }

    // Step 7: FIXED Enhanced theme extraction (stores themes in master_themes, categories in entities)
    console.log('=== FIXED STEP 7: ENHANCED THEME EXTRACTION ===');
    await extractThemes(supabaseAdmin, refinedText, entryId);

    // Step 8: FIXED Enhanced embedding generation
    console.log('=== FIXED STEP 8: ENHANCED EMBEDDING GENERATION ===');
    try {
      const embedding = await generateEmbedding(refinedText, openaiApiKey);
      await storeEmbedding(supabaseAdmin, entryId, refinedText, embedding);
      console.log('FIXED: Enhanced embeddings generated and stored successfully');
    } catch (embeddingError) {
      console.error('FIXED: Error with embeddings:', embeddingError);
    }

    // FIXED: Enhanced success response
    console.log('=== FIXED PIPELINE COMPLETE ===');
    console.log('FIXED: Enhanced processing complete, returning comprehensive response');
    
    return new Response(JSON.stringify({
      id: entryId,
      entryId: entryId,
      transcription: transcribedText,
      refined: refinedText,
      emotions: emotions,
      sentiment: sentimentResult.sentiment,
      language: finalLanguages[0] || 'unknown',
      languages: finalLanguages,
      duration: durationSeconds, // FIXED: Return correct duration in seconds
      audioUrl: audioUrl,
      processingTimestamp: requestTimestamp,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== FIXED PIPELINE ERROR ===');
    console.error('FIXED: Error in transcribe-audio function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString(),
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
