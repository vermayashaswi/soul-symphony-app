
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common emotion mappings to standardize input
const EMOTION_MAPPINGS = {
  "sad": ["sad", "sadness", "unhappy", "upset", "down", "depressed", "blue", "gloomy"],
  "angry": ["angry", "anger", "mad", "furious", "irritated", "annoyed", "frustrated"],
  "happy": ["happy", "happiness", "joy", "joyful", "delighted", "pleased", "cheerful", "content"],
  "anxious": ["anxious", "anxiety", "worried", "nervous", "stressed", "tense", "uneasy"],
  "fear": ["fear", "scared", "afraid", "terrified", "frightened", "panic"],
  "surprise": ["surprise", "surprised", "shocked", "astonished", "amazed"],
  "love": ["love", "loving", "affection", "fond", "tender", "caring", "adoration"],
  "disgust": ["disgust", "disgusted", "repulsed", "aversion"]
};

// Common time mappings to standardize input
const TIME_RANGES = {
  "day": ["today", "yesterday", "day"],
  "week": ["week", "this week", "last week", "past week", "recent days"],
  "month": ["month", "this month", "last month", "past month", "recent weeks"],
  "year": ["year", "this year", "last year", "past year"]
};

// Theme mapping to identify workplace-related themes
const THEME_MAPPINGS = {
  "workplace": ["work", "office", "workplace", "job", "career", "company", "business", "corporate", "enterprise", "employment", "profession", "occupation", "colleague", "coworker", "boss", "manager", "team", "project", "meeting", "deadline"]
};

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    console.log("Generating embedding for query:", text.substring(0, 50) + "...");
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    throw error;
  }
}

// Format emotions data into a readable string
function formatEmotions(emotions: Record<string, number> | null | undefined): string {
  if (!emotions) return "No emotion data available";
  
  // Sort emotions by intensity (highest first)
  const sortedEmotions = Object.entries(emotions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3); // Take top 3 emotions for brevity
    
  return sortedEmotions
    .map(([emotion, intensity]) => {
      // Convert intensity to percentage and format emotion name
      const percentage = Math.round(intensity * 100);
      const formattedEmotion = emotion.charAt(0).toUpperCase() + emotion.slice(1);
      return `${formattedEmotion} (${percentage}%)`;
    })
    .join(", ");
}

// Function to get previous messages from a thread
async function getPreviousMessages(threadId: string, messageLimit: number = 5) {
  if (!threadId) return [];
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('content, sender')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(messageLimit);
      
    if (error) {
      console.error("Error fetching previous messages:", error);
      return [];
    }
    
    // Return in chronological order (oldest first)
    return data.reverse().map(msg => ({
      role: msg.sender === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  } catch (error) {
    console.error("Error in getPreviousMessages:", error);
    return [];
  }
}

// Function to search journal entries with date range
async function searchJournalEntriesWithDate(
  userId: string, 
  queryEmbedding: any,
  startDate: string | null = null,
  endDate: string | null = null,
  matchThreshold: number = 0.5,
  matchCount: number = 5
) {
  try {
    console.log(`Calling match_journal_entries_with_date with userId: ${userId}`);
    console.log(`Date range: ${startDate || 'none'} to ${endDate || 'none'}`);
    
    const { data, error } = await supabase.rpc('match_journal_entries_with_date', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    });
    
    if (error) {
      console.error("Error in date-filtered similarity search:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Exception in searchJournalEntriesWithDate:", error);
    return null;
  }
}

// Function to search journal entries by emotion
async function searchJournalEntriesByEmotion(
  userId: string,
  emotion: string,
  minScore: number = 0.3,
  startDate: string | null = null,
  endDate: string | null = null,
  limitCount: number = 5
) {
  try {
    console.log(`Calling match_journal_entries_by_emotion with userId: ${userId}, emotion: ${emotion}`);
    console.log(`Date range: ${startDate || 'none'} to ${endDate || 'none'}, min score: ${minScore}`);
    
    const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
      emotion_name: emotion,
      min_score: minScore,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate,
      limit_count: limitCount
    });
    
    if (error) {
      console.error("Error in emotion-filtered search:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Exception in searchJournalEntriesByEmotion:", error);
    return null;
  }
}

// Function to search journal entries by theme
async function searchJournalEntriesByTheme(
  userId: string,
  themeQuery: string,
  matchThreshold: number = 0.5,
  matchCount: number = 5,
  startDate: string | null = null,
  endDate: string | null = null
) {
  try {
    console.log(`Calling match_journal_entries_by_theme with userId: ${userId}, theme query: ${themeQuery}`);
    console.log(`Date range: ${startDate || 'none'} to ${endDate || 'none'}, threshold: ${matchThreshold}`);
    
    const { data, error } = await supabase.rpc('match_journal_entries_by_theme', {
      theme_query: themeQuery,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    });
    
    if (error) {
      console.error("Error in theme-filtered search:", error);
      return null;
    }
    
    console.log(`Theme search found ${data?.length || 0} entries`);
    return data;
  } catch (error) {
    console.error("Exception in searchJournalEntriesByTheme:", error);
    return null;
  }
}

// Function to detect timeframe from text
function detectTimeframe(text: string): {timeType: string | null, startDate: string | null, endDate: string | null} {
  const lowerText = text.toLowerCase();
  const now = new Date();
  let timeType = null;
  let startDate = null;
  let endDate = now.toISOString();
  
  // Check for each time range
  for (const [range, keywords] of Object.entries(TIME_RANGES)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      timeType = range;
      
      // Calculate start date based on range
      if (range === 'day') {
        if (lowerText.includes('yesterday')) {
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          startDate = yesterday.toISOString();
          
          const endOfYesterday = new Date(now);
          endOfYesterday.setDate(now.getDate() - 1);
          endOfYesterday.setHours(23, 59, 59, 999);
          endDate = endOfYesterday.toISOString();
        } else {
          // Today
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          startDate = today.toISOString();
        }
      } else if (range === 'week') {
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        startDate = lastWeek.toISOString();
      } else if (range === 'month') {
        const lastMonth = new Date(now);
        lastMonth.setMonth(now.getMonth() - 1);
        startDate = lastMonth.toISOString();
      } else if (range === 'year') {
        const lastYear = new Date(now);
        lastYear.setFullYear(now.getFullYear() - 1);
        startDate = lastYear.toISOString();
      }
      
      break;
    }
  }
  
  return { timeType, startDate, endDate };
}

// Function to detect emotion from text
function detectEmotion(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [emotion, keywords] of Object.entries(EMOTION_MAPPINGS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return emotion;
    }
  }
  
  return null;
}

// Function to detect theme from text
function detectTheme(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [theme, keywords] of Object.entries(THEME_MAPPINGS)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return theme;
    }
  }
  
  return null;
}

// Function to detect query type
function analyzeQuery(text: string): {
  queryType: 'emotional' | 'temporal' | 'thematic' | 'general',
  emotion: string | null,
  theme: string | null,
  timeframe: {timeType: string | null, startDate: string | null, endDate: string | null},
  isWhenQuestion: boolean
} {
  const lowerText = text.toLowerCase();
  const emotion = detectEmotion(lowerText);
  const theme = detectTheme(lowerText);
  const timeframe = detectTimeframe(lowerText);
  const isWhenQuestion = lowerText.startsWith('when') || lowerText.includes('what time') || lowerText.includes('which day');
  
  // Determine query type based on the presence of emotion, theme, and time indicators
  let queryType: 'emotional' | 'temporal' | 'thematic' | 'general' = 'general';
  
  if (emotion) {
    queryType = 'emotional';
  } else if (theme) {
    queryType = 'thematic';
  } else if (timeframe.timeType) {
    queryType = 'temporal';
  }
  
  return {
    queryType,
    emotion,
    theme,
    timeframe,
    isWhenQuestion
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const diagnostics = {
    embeddingGenerated: false,
    embeddingError: null,
    similaritySearchComplete: false,
    searchError: null,
    contextBuilt: false,
    contextError: null,
    contextSize: 0,
    tokenCount: 0,
    llmError: null,
    processingTime: {
      embedding: 0,
      search: 0,
      context: 0,
      llm: 0,
      total: 0
    },
    queryAnalysis: null
  };
  
  const startTime = Date.now();

  try {
    const { message, userId, threadId, isNewThread, threadTitle, includeDiagnostics, timeframe } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Include diagnostics:", includeDiagnostics ? "yes" : "no");
    console.log("Thread ID:", threadId || "new thread");
    console.log("Timeframe specified:", timeframe || "none");
    
    // Analyze the query to determine approach
    const queryAnalysis = analyzeQuery(message);
    console.log("Query analysis:", JSON.stringify(queryAnalysis));
    diagnostics.queryAnalysis = queryAnalysis;
    
    let similarityScores = [];
    let similarEntries = null;
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const embeddingStartTime = Date.now();
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(message);
      diagnostics.embeddingGenerated = true;
      diagnostics.processingTime.embedding = Date.now() - embeddingStartTime;
    } catch (error) {
      console.error("Error generating embedding:", error);
      diagnostics.embeddingError = error.message;
      throw error;
    }
    
    // Search for relevant journal entries based on query type
    console.log("Searching for relevant context based on query type:", queryAnalysis.queryType);
    const searchStartTime = Date.now();
    
    if (queryAnalysis.queryType === 'emotional' && queryAnalysis.emotion) {
      // Use emotion-based search with time filtering
      console.log(`Using emotion-based search for ${queryAnalysis.emotion} with time filtering`);
      similarEntries = await searchJournalEntriesByEmotion(
        userId, 
        queryAnalysis.emotion,
        0.3, // Minimum emotion score
        queryAnalysis.timeframe.startDate,
        queryAnalysis.timeframe.endDate
      );
      
      if (similarEntries && similarEntries.length > 0) {
        console.log(`Found ${similarEntries.length} entries for emotion: ${queryAnalysis.emotion}`);
        similarityScores = similarEntries.map(entry => ({
          id: entry.id,
          score: entry.emotion_score
        }));
      } else {
        console.log(`No entries found with emotion: ${queryAnalysis.emotion}`);
      }
    } else if (queryAnalysis.queryType === 'thematic' && queryAnalysis.theme) {
      // Use theme-based search with time filtering
      console.log(`Using theme-based search for ${queryAnalysis.theme} with time filtering`);
      similarEntries = await searchJournalEntriesByTheme(
        userId,
        queryAnalysis.theme,
        0.4, // Lower threshold for theme matching to be more inclusive
        5,   // Return top 5 matches
        queryAnalysis.timeframe.startDate,
        queryAnalysis.timeframe.endDate
      );
      
      if (similarEntries && similarEntries.length > 0) {
        console.log(`Found ${similarEntries.length} entries for theme: ${queryAnalysis.theme}`);
        similarityScores = similarEntries.map(entry => ({
          id: entry.id,
          score: entry.similarity
        }));
      } else {
        console.log(`No entries found with theme: ${queryAnalysis.theme}`);
      }
    } else if (queryAnalysis.timeframe.timeType) {
      // Use time-based similarity search
      console.log("Using time-based similarity search");
      similarEntries = await searchJournalEntriesWithDate(
        userId, 
        queryEmbedding,
        queryAnalysis.timeframe.startDate,
        queryAnalysis.timeframe.endDate
      );
      
      if (similarEntries && similarEntries.length > 0) {
        console.log(`Found ${similarEntries.length} entries for timeframe: ${queryAnalysis.timeframe.timeType}`);
        similarityScores = similarEntries.map(entry => ({
          id: entry.id,
          score: entry.similarity
        }));
      } else {
        console.log("No entries found for specified timeframe");
      }
    } else {
      // Use standard similarity search
      console.log("Using standard similarity search");
      try {
        const { data, error } = await supabase.rpc(
          'match_journal_entries',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 5,
            user_id_filter: userId
          }
        );
        
        if (error) {
          console.error("Error searching for similar entries:", error);
          diagnostics.searchError = error.message || "Database search error";
        } else {
          similarEntries = data;
          if (similarEntries && similarEntries.length > 0) {
            console.log(`Found ${similarEntries.length} similar entries`);
            similarityScores = similarEntries.map(entry => ({
              id: entry.id,
              score: entry.similarity
            }));
          } else {
            console.log("No similar entries found");
          }
        }
      } catch (error) {
        console.error("Error in standard similarity search:", error);
        diagnostics.searchError = error.message || "Error in similarity search";
      }
    }
    
    diagnostics.similaritySearchComplete = true;
    diagnostics.processingTime.search = Date.now() - searchStartTime;
    
    // Create RAG context from relevant entries
    const contextStartTime = Date.now();
    let journalContext = "";
    let referenceEntries = [];
    
    try {
      if (similarEntries && similarEntries.length > 0) {
        console.log("Found similar entries:", similarEntries.length);
        
        // Fetch full entries for context
        const entryIds = similarEntries.map(entry => entry.id);
        
        // Using column name with space "refined text" instead of "refinedtext"
        const { data: entries, error: entriesError } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", created_at, emotions, master_themes')
          .in('id', entryIds);
        
        if (entriesError) {
          console.error("Error retrieving journal entries:", entriesError);
          diagnostics.contextError = entriesError.message || "Error retrieving journal entries";
        } else if (entries && entries.length > 0) {
          console.log("Retrieved full entries:", entries.length);
          
          // Store reference information
          referenceEntries = entries.map(entry => {
            // Find the similarity score for this entry
            const similarEntry = similarEntries.find(se => se.id === entry.id);
            const score = similarEntry?.similarity || similarEntry?.emotion_score || 0;
            
            return {
              id: entry.id,
              date: entry.created_at,
              snippet: entry["refined text"]?.substring(0, 100) + "...",
              similarity: score,
              emotions: entry.emotions,
              themes: entry.master_themes
            };
          });
          
          // Special formatting for thematic queries
          if (queryAnalysis.queryType === 'thematic' && queryAnalysis.theme) {
            journalContext = "Here are some of your journal entries related to '" + 
              queryAnalysis.theme + "' " + 
              (queryAnalysis.timeframe.timeType ? `from the ${queryAnalysis.timeframe.timeType} period` : "") + 
              ":\n\n" + 
              entries.map((entry, index) => {
                const date = new Date(entry.created_at).toLocaleDateString();
                const time = new Date(entry.created_at).toLocaleTimeString();
                const emotionsText = formatEmotions(entry.emotions);
                const themesText = entry.master_themes ? entry.master_themes.join(", ") : "No themes identified";
                
                return `Entry ${index+1} (${date} at ${time}):\n${entry["refined text"]}\nThemes: ${themesText}\nPrimary emotions: ${emotionsText}`;
              }).join('\n\n') + "\n\n";
          }
          // Special formatting for emotional queries
          else if (queryAnalysis.queryType === 'emotional' && queryAnalysis.emotion) {
            journalContext = "Here are some of your journal entries showing the emotion '" + 
              queryAnalysis.emotion + "' " + 
              (queryAnalysis.timeframe.timeType ? `from the ${queryAnalysis.timeframe.timeType} period` : "") + 
              ":\n\n" + 
              entries.map((entry, index) => {
                const date = new Date(entry.created_at).toLocaleDateString();
                const time = new Date(entry.created_at).toLocaleTimeString();
                const emotionsText = formatEmotions(entry.emotions);
                const themesText = entry.master_themes ? entry.master_themes.join(", ") : "No themes identified";
                const emotionScore = entry.emotions?.[queryAnalysis.emotion] 
                  ? `${queryAnalysis.emotion} intensity: ${Math.round(entry.emotions[queryAnalysis.emotion] * 100)}%` 
                  : '';
                
                return `Entry ${index+1} (${date} at ${time}):\n${entry["refined text"]}\n${emotionScore}\nThemes: ${themesText}\nPrimary emotions: ${emotionsText}`;
              }).join('\n\n') + "\n\n";
          } else {
            // Standard formatting for other queries
            journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
              entries.map((entry, index) => {
                const date = new Date(entry.created_at).toLocaleDateString();
                const time = new Date(entry.created_at).toLocaleTimeString();
                const emotionsText = formatEmotions(entry.emotions);
                const themesText = entry.master_themes ? entry.master_themes.join(", ") : "No themes identified";
                
                return `Entry ${index+1} (${date} at ${time}):\n${entry["refined text"]}\nThemes: ${themesText}\nPrimary emotions: ${emotionsText}`;
              }).join('\n\n') + "\n\n";
          }
            
          diagnostics.contextBuilt = true;
          diagnostics.contextSize = journalContext.length;
        }
      } else {
        console.log("No similar entries found, falling back to recent entries");
        // Fallback to recent entries if no similar ones found
        const { data: recentEntries, error: recentError } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", created_at, emotions, master_themes')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (recentError) {
          console.error("Error retrieving recent entries:", recentError);
          diagnostics.contextError = recentError.message || "Error retrieving recent entries";
        } else if (recentEntries && recentEntries.length > 0) {
          console.log("Retrieved recent entries:", recentEntries.length);
          
          // Store reference information
          referenceEntries = recentEntries.map(entry => ({
            id: entry.id,
            date: entry.created_at,
            snippet: entry["refined text"]?.substring(0, 100) + "...",
            type: "recent",
            themes: entry.master_themes
          }));
          
          journalContext = "Here are some of your recent journal entries:\n\n" + 
            recentEntries.map((entry, index) => {
              const date = new Date(entry.created_at).toLocaleDateString();
              const emotionsText = formatEmotions(entry.emotions);
              const themesText = entry.master_themes ? entry.master_themes.join(", ") : "No themes identified";
              
              return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nThemes: ${themesText}\nPrimary emotions: ${emotionsText}`;
            }).join('\n\n') + "\n\n";
            
          diagnostics.contextBuilt = true;
          diagnostics.contextSize = journalContext.length;
        }
      }
    } catch (contextError) {
      console.error("Error building context:", contextError);
      diagnostics.contextError = contextError.message || "Error building context";
    }
    
    diagnostics.processingTime.context = Date.now() - contextStartTime;
    
    // Get previous messages for context
    console.log("Fetching previous messages for conversation context...");
    const previousMessages = await getPreviousMessages(threadId);
    console.log(`Retrieved ${previousMessages.length} previous messages`);
    
    // Prepare system prompt with RAG context
    let systemPrompt = `You are SOULo, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}

Always maintain a warm, empathetic tone. If you notice concerning emotional patterns in the user's journal entries that might benefit from professional attention, 
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic.`;

    // Add special instructions for thematic queries
    if (queryAnalysis.queryType === 'thematic') {
      systemPrompt += `\n\nThe user is asking about the theme "${queryAnalysis.theme}" in their journal entries.
Focus on what happened related to this theme based on the journal entries provided.
Highlight specific events, patterns, and emotions connected to this theme.`;
    }
    // Add special instructions for emotional queries
    else if (queryAnalysis.queryType === 'emotional') {
      systemPrompt += `\n\nThe user is asking about the emotion "${queryAnalysis.emotion}" over a specific time period. 
Focus on when and why this emotion was strongest based on the journal entries provided.
If the user is asking "when" this emotion occurred, highlight the specific dates and times.`;
    } else if (queryAnalysis.isWhenQuestion) {
      systemPrompt += `\n\nThe user is asking about when something occurred. Be specific about dates and times in your answer, referring directly to the journal entries.`;
    }

    console.log("Sending to GPT with RAG context and conversation history...");
    
    // Build message history for the LLM
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add previous messages if available
    if (previousMessages.length > 0) {
      console.log("Including previous conversation context");
      messages.push(...previousMessages);
    }
    
    // Add current message
    messages.push({ role: 'user', content: message });
    
    const llmStartTime = Date.now();
    try {
      // Send to GPT with RAG context and conversation history
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GPT API error:", errorText);
        diagnostics.llmError = errorText || "Error from GPT API";
        throw new Error(`GPT API error: ${errorText}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      diagnostics.tokenCount = result.usage?.total_tokens || 0;
      diagnostics.processingTime.llm = Date.now() - llmStartTime;
      
      console.log("AI response generated successfully");
      
      diagnostics.processingTime.total = Date.now() - startTime;
      
      return new Response(
        JSON.stringify({ 
          response: aiResponse, 
          threadId: threadId,
          references: referenceEntries,
          diagnostics,
          similarityScores,
          queryAnalysis
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (apiError) {
      console.error("API error:", apiError);
      diagnostics.llmError = apiError.message || "API error";
      diagnostics.processingTime.total = Date.now() - startTime;
      
      // Return a 200 status even for errors to avoid CORS issues
      return new Response(
        JSON.stringify({ 
          error: apiError.message, 
          response: "I'm having trouble connecting right now. Please try again later.",
          success: false,
          diagnostics
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Error in chat-rag function:", error);
    diagnostics.processingTime.total = Date.now() - startTime;
    
    // Return 200 status even for errors to avoid CORS issues
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        success: false,
        diagnostics
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
