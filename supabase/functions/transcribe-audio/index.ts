
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { processAudio } from './audioProcessing.ts';
import { transcribeAudioWithWhisper, translateAndRefineText, analyzeEmotions, generateEmbedding } from './aiProcessing.ts';
import { createJournalEntry, updateJournalEntry, storeEmbedding } from './databaseOperations.ts';
import { uploadAudioFile } from './storageOperations.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Request size limits
const MAX_REQUEST_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

// Curated themes for better categorization
const CURATED_THEMES = [
  'Personal Growth', 'Relationships', 'Work & Career', 'Health & Wellness',
  'Family', 'Creativity', 'Learning', 'Travel', 'Hobbies', 'Spirituality',
  'Challenges', 'Achievements', 'Emotions', 'Goals', 'Reflection',
  'Gratitude', 'Stress', 'Joy', 'Sadness', 'Anxiety', 'Love', 'Fear',
  'Hope', 'Dreams', 'Memories', 'Friendship', 'Self-Care', 'Mindfulness'
];

function selectCuratedThemes(transcription: string, maxThemes: number = 3): string[] {
  const text = transcription.toLowerCase();
  const foundThemes: { theme: string; relevance: number }[] = [];
  
  for (const theme of CURATED_THEMES) {
    let relevance = 0;
    const themeWords = theme.toLowerCase().split(/[\s&]+/);
    
    for (const word of themeWords) {
      if (text.includes(word)) {
        relevance += 1;
      }
    }
    
    // Check for semantic associations
    if (theme === 'Personal Growth' && (text.includes('improve') || text.includes('better') || text.includes('grow'))) relevance += 2;
    if (theme === 'Relationships' && (text.includes('friend') || text.includes('partner') || text.includes('family'))) relevance += 2;
    if (theme === 'Work & Career' && (text.includes('job') || text.includes('work') || text.includes('career'))) relevance += 2;
    if (theme === 'Health & Wellness' && (text.includes('health') || text.includes('exercise') || text.includes('wellness'))) relevance += 2;
    if (theme === 'Emotions' && (text.includes('feel') || text.includes('emotion') || text.includes('mood'))) relevance += 2;
    if (theme === 'Gratitude' && (text.includes('grateful') || text.includes('thankful') || text.includes('appreciate'))) relevance += 2;
    if (theme === 'Stress' && (text.includes('stress') || text.includes('pressure') || text.includes('overwhelm'))) relevance += 2;
    
    if (relevance > 0) {
      foundThemes.push({ theme, relevance });
    }
  }
  
  // Sort by relevance and return top themes
  foundThemes.sort((a, b) => b.relevance - a.relevance);
  return foundThemes.slice(0, maxThemes).map(t => t.theme);
}

function calculateDuration(audioBlob: Uint8Array): number {
  try {
    // For WebM files, estimate duration based on file size
    // This is a rough approximation: ~8KB per second for typical voice recordings
    const estimatedDuration = audioBlob.length / 8000;
    
    // Clamp between reasonable bounds (1 second to 10 minutes)
    return Math.max(1, Math.min(600, Math.round(estimatedDuration)));
  } catch (error) {
    console.warn('[Audio] Could not calculate duration, using default:', error);
    return 30; // Default 30 seconds
  }
}

async function analyzeTextSentiment(text: string): Promise<string> {
  try {
    console.log('[Transcribe] Analyzing sentiment with OpenAI...');
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing text sentiment. Analyze the following text and return only one word: 'positive', 'negative', or 'neutral'."
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 10
      })
    });
    
    if (!response.ok) {
      console.error('[Transcribe] Sentiment analysis API error:', await response.text());
      return 'neutral';
    }
    
    const result = await response.json();
    const sentiment = result.choices[0].message.content.toLowerCase().trim();
    
    // Validate sentiment response
    if (['positive', 'negative', 'neutral'].includes(sentiment)) {
      return sentiment;
    }
    
    return 'neutral';
  } catch (error) {
    console.error('[Transcribe] Sentiment analysis error:', error);
    return 'neutral';
  }
}

// Helper function to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  try {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:audio\/[^;]+;base64,/, '');
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      throw new Error('Invalid base64 format');
    }
    
    // Decode base64
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('[Transcribe] Successfully converted base64 to Uint8Array, size:', bytes.length);
    return bytes;
  } catch (error) {
    console.error('[Transcribe] Error converting base64 to Uint8Array:', error);
    throw new Error('Invalid base64 audio data');
  }
}

// Enhanced request validation with better JSON parsing
async function validateAndParseRequest(req: Request): Promise<{
  audioData: Uint8Array;
  userId: string;
  audioType: string;
  duration?: number;
}> {
  const contentType = req.headers.get('content-type') || '';
  const contentLength = req.headers.get('content-length');
  
  console.log('[Transcribe] Request validation - Content-Type:', contentType, 'Content-Length:', contentLength);
  
  // Check request size
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    throw new Error(`Request too large: ${contentLength} bytes (max: ${MAX_REQUEST_SIZE})`);
  }
  
  let audioData: Uint8Array;
  let userId: string;
  let audioType: string = 'webm';
  let duration: number | undefined;
  
  try {
    if (contentType.includes('application/json')) {
      console.log('[Transcribe] Processing JSON request');
      
      // Check if request has content-length of 0
      if (contentLength === '0') {
        throw new Error('Request body is empty - no audio data provided');
      }
      
      // Read the request body with error handling
      let bodyText: string;
      try {
        bodyText = await req.text();
      } catch (error) {
        console.error('[Transcribe] Failed to read request body:', error);
        throw new Error('Failed to read request body');
      }
      
      console.log('[Transcribe] Raw body length:', bodyText.length);
      
      if (!bodyText || bodyText.trim() === '') {
        throw new Error('Request body is empty after reading');
      }
      
      // Validate JSON structure before parsing
      const trimmedBody = bodyText.trim();
      if (!trimmedBody.startsWith('{') || !trimmedBody.endsWith('}')) {
        console.error('[Transcribe] Invalid JSON structure. Body starts with:', trimmedBody.substring(0, 50));
        throw new Error('Invalid JSON structure - request body must be a JSON object');
      }
      
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(trimmedBody);
      } catch (parseError) {
        console.error('[Transcribe] JSON parse error:', parseError);
        console.error('[Transcribe] Body preview:', trimmedBody.substring(0, 200));
        throw new Error(`Invalid JSON format: ${parseError.message}`);
      }
      
      console.log('[Transcribe] Successfully parsed JSON body with keys:', Object.keys(parsedBody));
      
      // Validate required fields
      if (!parsedBody.audio) {
        throw new Error('Missing required field: audio');
      }
      if (!parsedBody.userId) {
        throw new Error('Missing required field: userId');
      }
      
      // Validate audio data type and content
      if (typeof parsedBody.audio !== 'string') {
        throw new Error('Audio field must be a base64 string');
      }
      
      if (parsedBody.audio.length < 100) {
        throw new Error('Audio data too short - likely invalid or corrupted');
      }
      
      console.log('[Transcribe] Converting base64 audio data, length:', parsedBody.audio.length);
      audioData = base64ToUint8Array(parsedBody.audio);
      userId = parsedBody.userId;
      
      // Calculate duration from recordingTime if available
      if (parsedBody.recordingTime && typeof parsedBody.recordingTime === 'number') {
        duration = Math.round(parsedBody.recordingTime / 1000);
        console.log('[Transcribe] Using provided duration:', duration, 'seconds');
      }
      
    } else if (contentType.includes('multipart/form-data')) {
      console.log('[Transcribe] Processing FormData request');
      
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File;
      const userIdField = formData.get('userId') as string;
      
      if (!audioFile) {
        throw new Error('Missing audio file in FormData');
      }
      if (!userIdField) {
        throw new Error('Missing userId in FormData');
      }
      
      // Validate file size
      if (audioFile.size > MAX_AUDIO_SIZE) {
        throw new Error(`Audio file too large: ${audioFile.size} bytes (max: ${MAX_AUDIO_SIZE})`);
      }
      
      if (audioFile.size < 100) {
        throw new Error('Audio file too small - likely invalid');
      }
      
      console.log('[Transcribe] Processing audio file:', audioFile.name, 'size:', audioFile.size);
      
      const audioBuffer = await audioFile.arrayBuffer();
      audioData = new Uint8Array(audioBuffer);
      userId = userIdField;
      audioType = audioFile.type.split('/')[1] || 'webm';
      
    } else {
      throw new Error(`Unsupported content type: ${contentType}. Expected application/json or multipart/form-data`);
    }
    
    // Final validation
    if (!audioData || audioData.length === 0) {
      throw new Error('No audio data received after processing');
    }
    
    if (audioData.length < 100) {
      throw new Error(`Audio data too small after processing: ${audioData.length} bytes`);
    }
    
    if (audioData.length > MAX_AUDIO_SIZE) {
      throw new Error(`Audio data too large after processing: ${audioData.length} bytes (max: ${MAX_AUDIO_SIZE})`);
    }
    
    console.log('[Transcribe] Request validation successful:', {
      audioDataSize: audioData.length,
      userId: userId,
      audioType: audioType,
      duration: duration
    });
    
    return {
      audioData,
      userId,
      audioType,
      duration
    };
    
  } catch (error) {
    console.error('[Transcribe] Request validation failed:', error);
    throw error;
  }
}

// Enhanced authentication validation
async function validateAuthentication(req: Request, userId: string) {
  const authHeader = req.headers.get('authorization');
  console.log('[Transcribe] Auth header present:', !!authHeader);
  
  let user = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      console.log('[Transcribe] Validating auth token...');
      
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authUser) {
        user = authUser;
        console.log('[Transcribe] Token validation successful for user:', authUser.id);
      } else {
        console.error('[Transcribe] Token validation failed:', authError);
      }
    } catch (error) {
      console.error('[Transcribe] Token validation error:', error);
    }
  }
  
  // Fallback validation - check if userId exists in profiles
  if (!user) {
    console.log('[Transcribe] No authenticated user found, validating userId exists in profiles');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (profileError || !profile) {
      console.error('[Transcribe] User validation failed:', profileError);
      throw new Error('Invalid user');
    }
    
    console.log('[Transcribe] Profile validation successful for userId:', userId);
    user = { id: userId };
  }

  if (user.id !== userId) {
    console.error('[Transcribe] User ID mismatch:', { authUserId: user.id, requestUserId: userId });
    throw new Error('User ID mismatch');
  }

  return user;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[Transcribe] ====== NEW REQUEST ======');
  console.log('[Transcribe] Method:', req.method);
  console.log('[Transcribe] URL:', req.url);
  console.log('[Transcribe] Headers:', Object.fromEntries(req.headers.entries()));

  try {
    // Validate and parse request with improved error handling
    const { audioData, userId, audioType, duration: providedDuration } = await validateAndParseRequest(req);

    // Validate authentication
    const user = await validateAuthentication(req, userId);
    console.log('[Transcribe] User validation successful for:', userId);

    // Calculate duration if not provided
    const duration = providedDuration || calculateDuration(audioData);
    console.log('[Transcribe] Using duration:', duration, 'seconds');

    // Process audio if needed
    console.log('[Transcribe] Processing audio...');
    const processedAudio = await processAudio(audioData);
    
    // Upload audio file to storage
    console.log('[Transcribe] Uploading audio file...');
    const audioUrl = await uploadAudioFile(processedAudio, userId);
    if (!audioUrl) {
      throw new Error('Failed to upload audio file');
    }

    // Create initial journal entry
    console.log('[Transcribe] Creating journal entry...');
    const journalEntry = await createJournalEntry({
      user_id: userId,
      audio_url: audioUrl,
      duration: duration,
    });

    if (!journalEntry) {
      throw new Error('Failed to create journal entry');
    }

    const entryId = journalEntry.id;
    console.log('[Transcribe] Created journal entry with ID:', entryId);

    // Transcribe audio using OpenAI Whisper
    console.log('[Transcribe] Starting transcription with OpenAI...');
    const transcriptionResult = await transcribeAudioWithWhisper(
      new Blob([processedAudio], { type: `audio/${audioType}` }),
      audioType,
      openaiApiKey
    );
    
    const transcription = transcriptionResult.text;
    const detectedLanguages = transcriptionResult.detectedLanguages;
    
    if (!transcription) {
      throw new Error('Failed to transcribe audio');
    }

    console.log('[Transcribe] Transcription completed, length:', transcription.length);

    // Update entry with transcription
    await updateJournalEntry(entryId, {
      'transcription text': transcription,
      languages: detectedLanguages,
    });

    // Translate and refine text if needed
    console.log('[Transcribe] Starting text refinement...');
    const refinementResult = await translateAndRefineText(transcription, openaiApiKey, detectedLanguages);
    const refinedText = refinementResult.refinedText;

    // Generate curated themes
    const themes = selectCuratedThemes(refinedText || transcription);
    console.log('[Transcribe] Selected themes:', themes);

    // Analyze sentiment
    console.log('[Transcribe] Starting sentiment analysis...');
    const sentiment = await analyzeTextSentiment(refinedText || transcription);

    // Get emotions data from database
    const { data: emotionsData } = await supabase
      .from('emotions')
      .select('name, description');

    let emotions = {};
    if (emotionsData && emotionsData.length > 0) {
      console.log('[Transcribe] Starting emotion analysis...');
      emotions = await analyzeEmotions(refinedText || transcription, emotionsData, openaiApiKey);
    }
    
    // Generate embedding
    console.log('[Transcribe] Generating embedding...');
    const embedding = await generateEmbedding(refinedText || transcription, openaiApiKey);
    
    // Store embedding using the database function
    if (embedding) {
      await storeEmbedding(entryId, embedding);
    }

    // Update journal entry with all analysis results
    const updateData: any = {
      'refined text': refinedText || transcription,
      sentiment: sentiment,
      emotions: emotions,
      master_themes: themes,
    };

    await updateJournalEntry(entryId, updateData);

    const processingTime = Date.now() - startTime;
    console.log('[Transcribe] Successfully completed processing for entry:', entryId, 'in', processingTime, 'ms');

    // Return the response
    return new Response(
      JSON.stringify({
        success: true,
        entryId: entryId,
        transcription: transcription,
        refinedText: refinedText || transcription,
        audioUrl: audioUrl,
        duration: duration,
        sentiment: sentiment,
        emotions: emotions,
        themes: themes,
        processingTime: processingTime
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[Transcribe] Error processing request:', error);
    console.error('[Transcribe] Error occurred after', processingTime, 'ms');
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'Failed to process audio';
    
    if (error.message.includes('Invalid user') || error.message.includes('User ID mismatch')) {
      statusCode = 401;
      errorMessage = 'Authentication failed';
    } else if (error.message.includes('too large') || error.message.includes('too small') || error.message.includes('Invalid') || error.message.includes('Missing') || error.message.includes('empty')) {
      statusCode = 400;
      errorMessage = 'Invalid request data';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message,
        processingTime: processingTime
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
