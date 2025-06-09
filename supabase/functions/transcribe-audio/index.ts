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

// Enhanced logging function
function logWithDetails(level: string, message: string, details?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(details && { details })
  };
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details, null, 2) : '');
}

// Enhanced base64 to Uint8Array conversion with comprehensive validation
function base64ToUint8Array(audioData: string): Uint8Array {
  try {
    logWithDetails('debug', 'Processing audio data format', {
      length: audioData.length,
      isDataUrl: audioData.startsWith('data:'),
      hasBase64Marker: audioData.includes('base64,'),
      prefix: audioData.substring(0, 50)
    });
    
    if (!audioData || typeof audioData !== 'string') {
      throw new Error('Audio data is not a valid string');
    }

    if (audioData.length < 100) {
      throw new Error(`Audio data too short: ${audioData.length} characters`);
    }
    
    let base64Data = audioData;
    
    // Handle both complete data URLs and raw base64
    if (audioData.startsWith('data:')) {
      if (!audioData.includes('base64,')) {
        throw new Error('Data URL missing base64 marker');
      }
      // Extract base64 portion from data URL
      const parts = audioData.split('base64,');
      if (parts.length !== 2) {
        throw new Error('Invalid data URL structure');
      }
      base64Data = parts[1];
      logWithDetails('debug', 'Extracted base64 from data URL', { 
        originalLength: audioData.length,
        extractedLength: base64Data.length 
      });
    }
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      throw new Error('Invalid base64 format - contains invalid characters');
    }
    
    if (base64Data.length < 100) {
      throw new Error(`Base64 data too short: ${base64Data.length} characters`);
    }
    
    // Test decode before processing
    let binaryString: string;
    try {
      binaryString = atob(base64Data);
    } catch (decodeError) {
      throw new Error(`Base64 decode failed: ${decodeError.message}`);
    }

    if (binaryString.length === 0) {
      throw new Error('Decoded binary string is empty');
    }

    if (binaryString.length > MAX_AUDIO_SIZE) {
      throw new Error(`Decoded audio too large: ${binaryString.length} bytes (max: ${MAX_AUDIO_SIZE})`);
    }
    
    // Convert to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    logWithDetails('info', 'Successfully converted to Uint8Array', {
      originalLength: audioData.length,
      base64Length: base64Data.length,
      binaryLength: binaryString.length,
      bytesLength: bytes.length,
      compressionRatio: (bytes.length / base64Data.length).toFixed(3)
    });
    
    return bytes;
  } catch (error) {
    logWithDetails('error', 'Error converting audio data', { 
      error: error.message,
      dataLength: audioData?.length || 0,
      dataType: typeof audioData,
      dataPrefix: audioData?.substring(0, 50) || 'N/A'
    });
    throw new Error(`Invalid audio data format: ${error.message}`);
  }
}

// Enhanced request validation with detailed error reporting
async function validateAndParseRequest(req: Request): Promise<{
  audioData: Uint8Array;
  userId: string;
  audioType: string;
  duration?: number;
  clientInfo?: any;
}> {
  const requestId = crypto.randomUUID();
  logWithDetails('info', 'Starting request validation', { requestId });

  try {
    const contentType = req.headers.get('content-type') || '';
    const contentLength = req.headers.get('content-length');
    const authHeader = req.headers.get('authorization');
    
    logWithDetails('debug', 'Request headers analysis', {
      requestId,
      contentType,
      contentLength,
      hasAuth: !!authHeader,
      userAgent: req.headers.get('user-agent')
    });
    
    // Enhanced empty body detection
    if (!contentLength || contentLength === '0') {
      logWithDetails('error', 'Request has no content length or zero content length', { 
        requestId,
        contentLength,
        allHeaders: Object.fromEntries(req.headers.entries())
      });
      throw new Error('Request body is empty - no audio data provided');
    }
    
    const contentLengthNum = parseInt(contentLength);
    if (isNaN(contentLengthNum)) {
      throw new Error(`Invalid content length: ${contentLength}`);
    }

    if (contentLengthNum > MAX_REQUEST_SIZE) {
      throw new Error(`Request too large: ${contentLength} bytes (max: ${MAX_REQUEST_SIZE})`);
    }

    if (contentLengthNum < 100) {
      throw new Error(`Request too small: ${contentLength} bytes (min: 100)`);
    }
    
    // Handle JSON requests with enhanced validation
    if (contentType.includes('application/json')) {
      logWithDetails('debug', 'Processing JSON request', { requestId, contentLengthNum });
      
      // Read request body with timeout and error handling
      let bodyText: string;
      const bodyReadStartTime = Date.now();
      
      try {
        // Add a timeout for reading the body
        const bodyPromise = req.text();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request body read timeout')), 30000); // 30 second timeout
        });
        
        bodyText = await Promise.race([bodyPromise, timeoutPromise]) as string;
        const bodyReadTime = Date.now() - bodyReadStartTime;
        
        logWithDetails('debug', 'Request body read successfully', {
          requestId,
          bodyLength: bodyText.length,
          readTime: bodyReadTime,
          expectedLength: contentLengthNum,
          lengthMatch: bodyText.length === contentLengthNum
        });
      } catch (error) {
        logWithDetails('error', 'Failed to read request body', {
          requestId,
          error: error.message,
          contentLength: contentLengthNum
        });
        throw new Error(`Failed to read request body: ${error.message}`);
      }
      
      if (!bodyText || bodyText.trim() === '') {
        logWithDetails('error', 'Request body is empty after reading', {
          requestId,
          bodyLength: bodyText?.length || 0,
          expectedLength: contentLengthNum
        });
        throw new Error('Request body is empty after reading - no data received');
      }

      // Check if body length matches content-length header
      const actualBodyLength = new TextEncoder().encode(bodyText).length;
      if (Math.abs(actualBodyLength - contentLengthNum) > 10) { // Allow small discrepancy
        logWithDetails('warn', 'Content-Length mismatch', {
          requestId,
          declaredLength: contentLengthNum,
          actualLength: actualBodyLength,
          difference: actualBodyLength - contentLengthNum
        });
      }
      
      // Validate JSON structure before parsing
      const trimmedBody = bodyText.trim();
      if (!trimmedBody.startsWith('{') || !trimmedBody.endsWith('}')) {
        logWithDetails('error', 'Invalid JSON structure', {
          requestId,
          bodyStart: trimmedBody.substring(0, 100),
          bodyEnd: trimmedBody.substring(Math.max(0, trimmedBody.length - 100))
        });
        throw new Error('Invalid JSON structure - request body must be a JSON object');
      }
      
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(trimmedBody);
        logWithDetails('debug', 'JSON parsed successfully', {
          requestId,
          keys: Object.keys(parsedBody),
          audioFieldPresent: !!parsedBody.audio,
          userIdPresent: !!parsedBody.userId,
          audioDataLength: parsedBody.audio?.length || 0
        });
      } catch (parseError) {
        logWithDetails('error', 'JSON parse error', {
          requestId,
          error: parseError.message,
          bodyPreview: trimmedBody.substring(0, 200)
        });
        throw new Error(`Invalid JSON format: ${parseError.message}`);
      }
      
      // Validate required fields with detailed error reporting
      const requiredFields = ['audio', 'userId'];
      const missingFields = requiredFields.filter(field => !parsedBody[field]);
      
      if (missingFields.length > 0) {
        logWithDetails('error', 'Missing required fields', {
          requestId,
          missingFields,
          presentFields: Object.keys(parsedBody)
        });
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Validate audio data type and content with enhanced checks
      if (typeof parsedBody.audio !== 'string') {
        throw new Error(`Audio field must be a string, got ${typeof parsedBody.audio}`);
      }
      
      if (parsedBody.audio.length < 100) {
        throw new Error(`Audio data too short: ${parsedBody.audio.length} characters (likely invalid or corrupted)`);
      }

      // Additional validation for data URL format
      if (!parsedBody.audio.startsWith('data:') && parsedBody.audio.length < 1000) {
        throw new Error('Audio data appears to be neither a valid data URL nor sufficient base64 content');
      }
      
      logWithDetails('debug', 'Converting audio data to Uint8Array', {
        requestId,
        audioLength: parsedBody.audio.length,
        audioType: typeof parsedBody.audio,
        isDataUrl: parsedBody.audio.startsWith('data:'),
        hasBase64: parsedBody.audio.includes('base64,')
      });
      
      const audioData = base64ToUint8Array(parsedBody.audio);
      const userId = parsedBody.userId;
      
      // Calculate duration from recordingTime if available
      let duration: number | undefined;
      if (parsedBody.recordingTime && typeof parsedBody.recordingTime === 'number') {
        duration = Math.round(parsedBody.recordingTime / 1000);
        logWithDetails('debug', 'Using provided duration', { requestId, duration });
      }

      // Extract client info if available
      const clientInfo = parsedBody.clientInfo || null;
      
      logWithDetails('info', 'Request validation successful', {
        requestId,
        audioDataSize: audioData.length,
        userId,
        duration,
        hasClientInfo: !!clientInfo
      });
      
      return {
        audioData,
        userId,
        audioType: 'webm', // Default type for JSON requests
        duration,
        clientInfo
      };
      
    } else {
      throw new Error(`Unsupported content type: ${contentType}. Expected application/json`);
    }
    
  } catch (error) {
    logWithDetails('error', 'Request validation failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Enhanced authentication validation
async function validateAuthentication(req: Request, userId: string) {
  const authHeader = req.headers.get('authorization');
  logWithDetails('debug', 'Starting authentication validation', { 
    hasAuthHeader: !!authHeader,
    userId 
  });
  
  let user = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      logWithDetails('debug', 'Validating auth token', { tokenLength: token.length });
      
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && authUser) {
        user = authUser;
        logWithDetails('info', 'Token validation successful', { userId: authUser.id });
      } else {
        logWithDetails('warn', 'Token validation failed', { error: authError?.message });
      }
    } catch (error) {
      logWithDetails('error', 'Token validation error', { error: error.message });
    }
  }
  
  // Fallback validation - check if userId exists in profiles
  if (!user) {
    logWithDetails('debug', 'No authenticated user found, validating userId exists in profiles');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
      
    if (profileError || !profile) {
      logWithDetails('error', 'User validation failed', { error: profileError?.message });
      throw new Error('Invalid user');
    }
    
    logWithDetails('info', 'Profile validation successful', { userId });
    user = { id: userId };
  }

  if (user.id !== userId) {
    logWithDetails('error', 'User ID mismatch', { 
      authUserId: user.id, 
      requestUserId: userId 
    });
    throw new Error('User ID mismatch');
  }

  return user;
}

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
  
  foundThemes.sort((a, b) => b.relevance - a.relevance);
  return foundThemes.slice(0, maxThemes).map(t => t.theme);
}

function calculateDuration(audioBlob: Uint8Array): number {
  try {
    const estimatedDuration = audioBlob.length / 8000;
    return Math.max(1, Math.min(600, Math.round(estimatedDuration)));
  } catch (error) {
    console.warn('[Audio] Could not calculate duration, using default:', error);
    return 30;
  }
}

async function analyzeTextSentiment(text: string): Promise<string> {
  try {
    logWithDetails('debug', 'Analyzing sentiment with OpenAI');
    
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
      logWithDetails('error', 'Sentiment analysis API error', { 
        status: response.status,
        statusText: response.statusText
      });
      return 'neutral';
    }
    
    const result = await response.json();
    const sentiment = result.choices[0].message.content.toLowerCase().trim();
    
    if (['positive', 'negative', 'neutral'].includes(sentiment)) {
      return sentiment;
    }
    
    return 'neutral';
  } catch (error) {
    logWithDetails('error', 'Sentiment analysis error', { error: error.message });
    return 'neutral';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  logWithDetails('info', '====== NEW REQUEST ======', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent'),
    contentLength: req.headers.get('content-length'),
    contentType: req.headers.get('content-type')
  });

  try {
    // Validate and parse request with enhanced error handling
    const { audioData, userId, audioType, duration: providedDuration, clientInfo } = await validateAndParseRequest(req);

    // Validate authentication
    const user = await validateAuthentication(req, userId);
    logWithDetails('info', 'User validation successful', { requestId, userId });

    // Calculate duration if not provided
    const duration = providedDuration || calculateDuration(audioData);
    logWithDetails('debug', 'Using duration', { requestId, duration, provided: !!providedDuration });

    // Process audio if needed
    logWithDetails('debug', 'Processing audio', { requestId });
    const processedAudio = await processAudio(audioData);
    
    // Upload audio file to storage
    logWithDetails('debug', 'Uploading audio file', { requestId });
    const audioUrl = await uploadAudioFile(processedAudio, userId);
    if (!audioUrl) {
      throw new Error('Failed to upload audio file');
    }

    // Create initial journal entry
    logWithDetails('debug', 'Creating journal entry', { requestId });
    const journalEntry = await createJournalEntry({
      user_id: userId,
      audio_url: audioUrl,
      duration: duration,
    });

    if (!journalEntry) {
      throw new Error('Failed to create journal entry');
    }

    const entryId = journalEntry.id;
    logWithDetails('info', 'Created journal entry', { requestId, entryId });

    // Transcribe audio using OpenAI Whisper
    logWithDetails('debug', 'Starting transcription with OpenAI', { requestId });
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

    logWithDetails('info', 'Transcription completed', { 
      requestId, 
      transcriptionLength: transcription.length,
      languages: detectedLanguages 
    });

    // Update entry with transcription
    await updateJournalEntry(entryId, {
      'transcription text': transcription,
      languages: detectedLanguages,
    });

    // Continue with text refinement and analysis
    logWithDetails('debug', 'Starting text refinement', { requestId });
    const refinementResult = await translateAndRefineText(transcription, openaiApiKey, detectedLanguages);
    const refinedText = refinementResult.refinedText;

    // Generate curated themes
    const themes = selectCuratedThemes(refinedText || transcription);
    logWithDetails('debug', 'Selected themes', { requestId, themes });

    // Analyze sentiment
    logWithDetails('debug', 'Starting sentiment analysis', { requestId });
    const sentiment = await analyzeTextSentiment(refinedText || transcription);

    // Get emotions data from database
    const { data: emotionsData } = await supabase
      .from('emotions')
      .select('name, description');

    let emotions = {};
    if (emotionsData && emotionsData.length > 0) {
      logWithDetails('debug', 'Starting emotion analysis', { requestId });
      emotions = await analyzeEmotions(refinedText || transcription, emotionsData, openaiApiKey);
    }
    
    // Generate embedding
    logWithDetails('debug', 'Generating embedding', { requestId });
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
    logWithDetails('info', 'Successfully completed processing', {
      requestId,
      entryId,
      processingTime,
      audioSize: audioData.length,
      transcriptionLength: transcription.length
    });

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
        processingTime: processingTime,
        requestId: requestId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logWithDetails('error', 'Error processing request', {
      requestId,
      error: error.message,
      stack: error.stack,
      processingTime
    });
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'Failed to process audio';
    
    if (error.message.includes('Invalid user') || error.message.includes('User ID mismatch')) {
      statusCode = 401;
      errorMessage = 'Authentication failed';
    } else if (error.message.includes('too large') || error.message.includes('too small') || 
               error.message.includes('Invalid') || error.message.includes('Missing') || 
               error.message.includes('empty')) {
      statusCode = 400;
      errorMessage = 'Invalid request data';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message,
        processingTime: processingTime,
        requestId: requestId
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
