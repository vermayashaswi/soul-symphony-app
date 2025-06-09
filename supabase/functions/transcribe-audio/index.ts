
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { processAudio } from './audioProcessing.ts';
import { transcribeWithDeepgram } from './nlProcessing.ts';
import { transcribeAudioWithWhisper, translateAndRefineText, analyzeEmotions, generateEmbedding } from './aiProcessing.ts';
import { createJournalEntry, updateJournalEntry, storeEmbedding } from './databaseOperations.ts';
import { uploadAudioFile } from './storageOperations.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    
    // Decode base64
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  } catch (error) {
    console.error('[Transcribe] Error converting base64 to Uint8Array:', error);
    throw new Error('Invalid base64 audio data');
  }
}

// Helper function to detect request content type and extract data
async function extractRequestData(req: Request): Promise<{
  audioData: Uint8Array;
  userId: string;
  audioType: string;
  duration?: number;
}> {
  const contentType = req.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    // Handle JSON payload with base64 audio (from audio-processing.ts)
    console.log('[Transcribe] Processing JSON payload with base64 audio');
    
    const body = await req.json();
    const { audio, userId, recordingTime } = body;
    
    if (!audio || !userId) {
      throw new Error('Missing audio or userId in JSON payload');
    }
    
    // Convert base64 to Uint8Array
    const audioData = base64ToUint8Array(audio);
    
    // Calculate duration from recordingTime if available
    let duration = 30; // default
    if (recordingTime && typeof recordingTime === 'number') {
      duration = Math.round(recordingTime / 1000); // Convert ms to seconds
    }
    
    return {
      audioData,
      userId,
      audioType: 'webm', // Default for base64 audio
      duration
    };
  } else if (contentType.includes('multipart/form-data')) {
    // Handle FormData payload (from VoiceRecorder component)
    console.log('[Transcribe] Processing FormData payload');
    
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const userId = formData.get('userId') as string;
    
    if (!audioFile || !userId) {
      throw new Error('Missing audio file or userId in FormData');
    }
    
    // Convert File to Uint8Array
    const audioBuffer = await audioFile.arrayBuffer();
    const audioData = new Uint8Array(audioBuffer);
    
    // Extract audio type from file
    const audioType = audioFile.type.split('/')[1] || 'webm';
    
    return {
      audioData,
      userId,
      audioType,
      duration: undefined // Will be calculated later
    };
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[Transcribe] Processing audio transcription request');
    console.log('[Transcribe] Content-Type:', req.headers.get('content-type'));
    
    // Extract audio data and metadata from request
    const { audioData, userId, audioType, duration: providedDuration } = await extractRequestData(req);
    
    console.log('[Transcribe] Extracted data:', {
      audioDataSize: audioData.length,
      userId: userId,
      audioType: audioType,
      providedDuration: providedDuration
    });

    // Validate user authentication - get from Authorization header for JSON requests
    const authHeader = req.headers.get('authorization');
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && authUser) {
          user = authUser;
        }
      } catch (error) {
        console.error('[Transcribe] Token validation error:', error);
      }
    }
    
    // For FormData requests, try getting user from service role
    if (!user) {
      try {
        const { data: { user: serviceUser }, error: serviceError } = await supabase.auth.getUser();
        if (!serviceError && serviceUser) {
          user = serviceUser;
        }
      } catch (error) {
        console.error('[Transcribe] Service role user check error:', error);
      }
    }

    // If we still don't have a user, check if the userId matches any existing user
    if (!user) {
      console.log('[Transcribe] No authenticated user found, validating userId exists in profiles');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
        
      if (profileError || !profile) {
        console.error('[Transcribe] User validation failed:', profileError);
        return new Response(
          JSON.stringify({ error: 'Invalid user' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Create a mock user object for processing
      user = { id: userId };
    }

    if (user.id !== userId) {
      console.error('[Transcribe] User ID mismatch:', { authUserId: user.id, requestUserId: userId });
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Transcribe] User validation successful for:', userId);

    // Calculate duration if not provided
    const duration = providedDuration || calculateDuration(audioData);
    console.log('[Transcribe] Using duration:', duration, 'seconds');

    // Process audio if needed
    const processedAudio = await processAudio(audioData);
    
    // Upload audio file to storage
    const audioUrl = await uploadAudioFile(processedAudio, userId);
    if (!audioUrl) {
      throw new Error('Failed to upload audio file');
    }

    // Create initial journal entry
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

    console.log('[Transcribe] Successfully completed processing for entry:', entryId);

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
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Transcribe] Error processing request:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process audio',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
