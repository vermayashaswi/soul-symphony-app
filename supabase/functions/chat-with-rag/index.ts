
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

// Add function execution tracking
const functionExecutions = [];

// Function to track function executions
const trackFunctionExecution = (name: string, params?: Record<string, any>) => {
  const execution = {
    name,
    params,
    result: null,
    executionTime: 0,
    success: false
  };
  
  const startTime = Date.now();
  
  return {
    execution,
    succeed: (result?: any) => {
      execution.result = result;
      execution.executionTime = Date.now() - startTime;
      execution.success = true;
      functionExecutions.push(execution);
      return result;
    },
    fail: (error?: any) => {
      execution.result = error?.message || "Failed";
      execution.executionTime = Date.now() - startTime;
      execution.success = false;
      functionExecutions.push(execution);
      throw error;
    }
  };
};

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  const tracker = trackFunctionExecution("generateEmbedding", { text: text.substring(0, 50) + "..." });
  
  try {
    console.log("Generating embedding for query:", text.substring(0, 50) + "...");
    
    if (!openAIApiKey) {
      console.error("OpenAI API key is not set");
      return tracker.fail(new Error('OpenAI API key is not configured'));
    }
    
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
      const errorText = await response.text();
      console.error('Error generating embedding:', errorText);
      return tracker.fail(new Error(`Failed to generate embedding: ${errorText}`));
    }

    const result = await response.json();
    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      console.error('Unexpected embedding response structure:', result);
      return tracker.fail(new Error('Invalid embedding response structure'));
    }
    
    return tracker.succeed(result.data[0].embedding);
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    return tracker.fail(error);
  }
}

// Function to search journal entries by theme
async function searchJournalEntriesByTheme(
  userId: string, 
  themeQuery: string,
  queryEmbedding: any,
  matchThreshold: number = 0.5,
  matchCount: number = 10, // Increased from 5 to get more results
  startDate: string | null = null,
  endDate: string | null = null
) {
  const tracker = trackFunctionExecution("searchJournalEntriesByTheme", { 
    userId, 
    themeQuery,
    matchThreshold,
    matchCount,
    startDate,
    endDate
  });
  
  try {
    console.log(`Searching for theme-related entries with userId: ${userId}, theme query: ${themeQuery}`);
    
    // First try direct theme matching
    const { data: themeResults, error: themeError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at, master_themes')
      .eq('user_id', userId)
      .contains('master_themes', [themeQuery])
      .order('created_at', { ascending: false })
      .limit(matchCount);

    if (themeError) {
      console.error("Error in theme matching:", themeError);
    } else if (themeResults && themeResults.length > 0) {
      console.log(`Found ${themeResults.length} entries through direct theme matching`);
      return tracker.succeed(themeResults.map(entry => ({
        ...entry,
        content: entry["refined text"],
        similarity: 1.0 // High relevance for direct matches
      })));
    }

    // If no direct matches, try vector similarity search
    console.log("No direct theme matches, trying vector similarity search");
    
    // Cast user_id to UUID using ::uuid
    const rpcParams = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    };
    
    console.log("RPC params:", rpcParams);
    
    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'match_journal_entries_with_date',
      rpcParams
    );

    if (vectorError) {
      console.error("Error in vector similarity search:", vectorError);
      return tracker.fail(vectorError);
    }

    console.log(`Found ${vectorResults?.length || 0} entries through vector similarity`);
    return tracker.succeed(vectorResults || []);

  } catch (error) {
    console.error("Exception in searchJournalEntriesByTheme:", error);
    return tracker.fail(error);
  }
}

// Function to search journal entries using text search
async function searchJournalEntriesByText(
  userId: string,
  searchTerm: string,
  limit: number = 5
) {
  const tracker = trackFunctionExecution("searchJournalEntriesByText", {
    userId,
    searchTerm,
    limit
  });
  
  try {
    console.log(`Searching for text matches with userId: ${userId}, search term: ${searchTerm}`);
    
    // Search in the refined text and transcription text
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at')
      .eq('user_id', userId)
      .or(`refined_text.ilike.%${searchTerm}%,transcription_text.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error("Error in text search:", error);
      return tracker.fail(error);
    }
    
    console.log(`Text search found ${data?.length || 0} entries`);
    
    // Format the results similar to other search functions
    return tracker.succeed((data || []).map(entry => ({
      id: entry.id,
      content: entry["refined text"],
      created_at: entry.created_at,
      similarity: 0.7, // Arbitrary similarity for text matches
      type: 'text_match'
    })));
  } catch (error) {
    console.error("Exception in searchJournalEntriesByText:", error);
    return tracker.fail(error);
  }
}

// Function to search journal entries with date range and higher default limit
async function searchJournalEntriesWithDate(
  userId: string, 
  queryEmbedding: any,
  startDate: string | null = null,
  endDate: string | null = null,
  matchThreshold: number = 0.5,
  matchCount: number = 10 // Increased from 5 to get more results
) {
  const tracker = trackFunctionExecution("searchJournalEntriesWithDate", { 
    userId, 
    startDate, 
    endDate, 
    matchThreshold, 
    matchCount 
  });
  
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
    // Cast user_id to UUID using ::uuid
    const rpcParams = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    };
    
    console.log("RPC params for match_journal_entries_with_date:", JSON.stringify(rpcParams));
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      rpcParams
    );
    
    if (error) {
      console.error("Error in vector similarity search:", error);
      return tracker.fail(error);
    }
    
    console.log(`Vector similarity search found ${data?.length || 0} entries`);
    return tracker.succeed(data || []);
  } catch (error) {
    console.error("Exception in searchJournalEntriesWithDate:", error);
    return tracker.fail(error);
  }
}

// Function to search by emotion terms
async function searchEntriesByEmotionTerm(
  userId: string,
  emotionTerm: string,
  startDate: string | null = null,
  endDate: string | null = null,
  limit: number = 5
) {
  const tracker = trackFunctionExecution("searchEntriesByEmotionTerm", {
    userId,
    emotionTerm,
    startDate,
    endDate,
    limit
  });
  
  try {
    console.log(`Searching entries by emotion term: ${emotionTerm} for userId: ${userId}`);
    
    const rpcParams = {
      emotion_term: emotionTerm,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate,
      limit_count: limit
    };
    
    console.log("RPC params for get_entries_by_emotion_term:", JSON.stringify(rpcParams));
    
    const { data, error } = await supabase.rpc(
      'get_entries_by_emotion_term',
      rpcParams
    );
    
    if (error) {
      console.error("Error in emotion term search:", error);
      return tracker.fail(error);
    }
    
    console.log(`Emotion term search found ${data?.length || 0} entries`);
    
    return tracker.succeed((data || []).map(entry => ({
      id: entry.id,
      content: entry.content,
      created_at: entry.created_at,
      similarity: 0.8, // Arbitrary similarity for emotion matches
      type: 'emotion_match'
    })));
    
  } catch (error) {
    console.error("Exception in searchEntriesByEmotionTerm:", error);
    return tracker.fail(error);
  }
}

// Function to analyze query and determine search strategy
function analyzeQuery(text: string): {
  queryType: 'emotional' | 'temporal' | 'thematic' | 'general',
  emotion: string | null,
  theme: string | null,
  timeframe: {timeType: string | null, startDate: string | null, endDate: string | null},
  isWhenQuestion: boolean
} {
  const lowerText = text.toLowerCase();
  
  // Check for "when" questions
  const isWhenQuestion = lowerText.includes('when') && 
                          (lowerText.endsWith('?') || lowerText.includes('when was') || 
                           lowerText.includes('when did') || lowerText.includes('when were'));
  
  // Check for emotional keywords
  const emotionKeywords = {
    sad: ['sad', 'unhappy', 'depressed', 'upset', 'disappointed', 'down', 'miserable', 'gloomy'],
    happy: ['happy', 'joy', 'glad', 'pleased', 'delighted', 'content', 'cheerful', 'joyful'],
    angry: ['angry', 'mad', 'furious', 'irritated', 'annoyed', 'upset', 'frustrated'],
    anxious: ['anxious', 'worried', 'nervous', 'stressed', 'uneasy', 'tense', 'fear', 'afraid'],
    surprised: ['surprised', 'shocked', 'amazed', 'astonished', 'stunned']
  };
  
  let emotionFound = null;
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      emotionFound = emotion;
      break;
    }
  }
  
  // Define theme keywords for workplace context
  const workplaceKeywords = [
    'work', 'office', 'job', 'career', 'company', 'business', 'workplace',
    'meeting', 'project', 'colleague', 'manager', 'boss', 'team',
    'client', 'deadline', 'presentation', 'email', 'corporate'
  ];

  // Check for workplace-related terms
  const foundWorkplaceKeywords = workplaceKeywords.filter(keyword => 
    lowerText.includes(keyword)
  );

  // Detect timeframe
  const timeframe = detectTimeframe(text);
  
  // Determine query type and search strategy
  let queryType: 'emotional' | 'temporal' | 'thematic' | 'general' = 'general';
  let theme = null;

  if (emotionFound) {
    queryType = 'emotional';
  } else if (foundWorkplaceKeywords.length > 0) {
    queryType = 'thematic';
    theme = 'workplace';
  } else if (timeframe.timeType) {
    queryType = 'temporal';
  }

  return {
    queryType,
    emotion: emotionFound,
    theme,
    timeframe,
    isWhenQuestion
  };
}

// Function to detect timeframe from text
function detectTimeframe(text: string): {timeType: string | null, startDate: string | null, endDate: string | null} {
  const lowerText = text.toLowerCase();
  const now = new Date();
  let timeType = null;
  let startDate = null;
  let endDate = now.toISOString();
  
  // Check for each time range
  if (lowerText.includes('yesterday')) {
    timeType = 'day';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    startDate = yesterday.toISOString();
    
    const endOfYesterday = new Date(now);
    endOfYesterday.setDate(now.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);
    endDate = endOfYesterday.toISOString();
  } else if (lowerText.includes('today')) {
    timeType = 'day';
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    startDate = today.toISOString();
  } else if (lowerText.includes('last week') || lowerText.includes('this week') || 
      lowerText.includes('past week') || lowerText.includes('recent days')) {
    timeType = 'week';
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    startDate = lastWeek.toISOString();
  } else if (lowerText.includes('last month') || lowerText.includes('this month') || 
      lowerText.includes('past month') || lowerText.includes('recent weeks')) {
    timeType = 'month';
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);
    startDate = lastMonth.toISOString();
  } else if (lowerText.includes('last year') || lowerText.includes('this year') || 
      lowerText.includes('past year')) {
    timeType = 'year';
    const lastYear = new Date(now);
    lastYear.setFullYear(now.getFullYear() - 1);
    startDate = lastYear.toISOString();
  }
  
  return { timeType, startDate, endDate };
}

// Function to get recent entries when search fails
async function getRecentEntries(userId: string, limit: number = 3) {
  const tracker = trackFunctionExecution("getRecentEntries", { userId, limit });
  
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error("Error fetching recent entries:", error);
      return tracker.fail(error);
    }
    
    console.log(`Retrieved recent entries: ${data?.length || 0}`);
    
    return tracker.succeed(data?.map(entry => ({
      id: entry.id,
      content: entry["refined text"],
      created_at: entry.created_at,
      similarity: 0.5,  // Arbitrary similarity score for recent entries
      type: 'recent'
    })) || []);
    
  } catch (error) {
    console.error("Exception in getRecentEntries:", error);
    return tracker.fail(error);
  }
}

// Function to get previous messages from a thread
async function getPreviousMessages(threadId: string, limit: number = 10) {
  const tracker = trackFunctionExecution("getPreviousMessages", { threadId, limit });
  
  try {
    if (!threadId) {
      console.log("No thread ID provided");
      return tracker.succeed([]);
    }
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error("Error fetching previous messages:", error);
      return tracker.fail(error);
    }
    
    console.log(`Retrieved ${data?.length || 0} previous messages`);
    return tracker.succeed(data || []);
    
  } catch (error) {
    console.error("Exception in getPreviousMessages:", error);
    return tracker.fail(error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const diagnostics = {
    queryAnalysis: null,
    searchStrategy: null,
    searchAttempts: [],
    resultsFound: 0,
    timings: {
      total: 0,
      embedding: 0,
      search: 0,
      context: 0
    }
  };

  const startTime = Date.now();

  try {
    const { message, userId, threadId = null } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Missing required parameters');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Thread ID:", threadId || "new thread");
    console.log("Include diagnostics: yes");
    
    // Analyze query to determine search strategy
    const queryAnalysis = analyzeQuery(message);
    console.log("Query analysis:", JSON.stringify(queryAnalysis));
    
    diagnostics.queryAnalysis = queryAnalysis;
    
    // Set search strategy based on query analysis
    let searchStrategy = 'general_similarity';
    
    if (queryAnalysis.queryType === 'emotional') {
      searchStrategy = 'emotion_based';
    } else if (queryAnalysis.queryType === 'thematic') {
      searchStrategy = 'theme_based';
    } else if (queryAnalysis.queryType === 'temporal') {
      searchStrategy = 'time_based';
    } else if (queryAnalysis.isWhenQuestion) {
      searchStrategy = 'temporal_question';
    }
    
    diagnostics.searchStrategy = searchStrategy;

    // Generate embedding for the query
    console.log("Generating embedding for user query...");
    let queryEmbedding;
    let embeddingError = null;
    const embeddingStartTime = Date.now();
    
    try {
      queryEmbedding = await generateEmbedding(message);
      diagnostics.timings.embedding = Date.now() - embeddingStartTime;
    } catch (error) {
      console.error("Error generating embedding:", error);
      embeddingError = error.message || "Failed to generate embedding";
      diagnostics.timings.embedding = Date.now() - embeddingStartTime;
    }

    let similarEntries = [];
    const searchStartTime = Date.now();

    // If embedding failed, try alternative search methods
    if (!queryEmbedding) {
      console.log("Embedding generation failed, trying alternative search methods");
      
      diagnostics.searchAttempts.push({
        type: 'embedding_failed',
        error: embeddingError,
        fallback: 'emotion_text_search'
      });
      
      // Try emotion-based search if we detected an emotion
      if (queryAnalysis.queryType === 'emotional' && queryAnalysis.emotion) {
        console.log(`Using emotion term search for ${queryAnalysis.emotion}`);
        
        try {
          const emotionResults = await searchEntriesByEmotionTerm(
            userId,
            queryAnalysis.emotion,
            queryAnalysis.timeframe.startDate,
            queryAnalysis.timeframe.endDate,
            10
          );
          
          if (emotionResults && emotionResults.length > 0) {
            similarEntries = emotionResults;
          }
        } catch (error) {
          console.error("Error in emotion term search:", error);
        }
      }
      
      // Try text-based search for workplace themes
      if (similarEntries.length === 0 && queryAnalysis.queryType === 'thematic') {
        console.log("Using text search for workplace terms");
        
        try {
          const textResults = await searchJournalEntriesByText(
            userId,
            "work", // Use "work" as a fallback search term
            10
          );
          
          if (textResults && textResults.length > 0) {
            similarEntries = textResults;
          }
        } catch (error) {
          console.error("Error in text search:", error);
        }
      }
    } else {
      // If we have an embedding, use it for search
      console.log("Using embedding for search");
      
      // Implement search based on query analysis
      if (queryAnalysis.queryType === 'emotional' && queryAnalysis.emotion) {
        console.log(`Using emotion-based search for ${queryAnalysis.emotion}`);
        
        diagnostics.searchAttempts.push({
          type: 'emotion_based',
          emotion: queryAnalysis.emotion
        });
        
        try {
          const emotionResults = await searchEntriesByEmotionTerm(
            userId,
            queryAnalysis.emotion,
            queryAnalysis.timeframe.startDate,
            queryAnalysis.timeframe.endDate,
            10
          );
          
          if (emotionResults && emotionResults.length > 0) {
            similarEntries = emotionResults;
          } else {
            // Fallback to vector similarity
            console.log("No emotion results, falling back to vector similarity");
            
            diagnostics.searchAttempts.push({
              type: 'vector_similarity_fallback',
              threshold: 0.4
            });
            
            const vectorResults = await searchJournalEntriesWithDate(
              userId,
              queryEmbedding,
              queryAnalysis.timeframe.startDate,
              queryAnalysis.timeframe.endDate,
              0.4,
              10
            );
            
            if (vectorResults && vectorResults.length > 0) {
              similarEntries = vectorResults;
            }
          }
        } catch (error) {
          console.error("Error in emotion search with fallback:", error);
        }
      } else if (queryAnalysis.queryType === 'thematic' && queryAnalysis.theme) {
        // For workplace queries, use theme-based search with backup to vector similarity
        console.log("Searching for relevant context based on query type:", queryAnalysis.queryType);
        
        diagnostics.searchAttempts.push({
          type: 'theme_based',
          theme: queryAnalysis.theme
        });
        
        try {
          console.log(`Using theme-based search for ${queryAnalysis.theme} with time filtering`);
          
          const themeResults = await searchJournalEntriesByTheme(
            userId,
            queryAnalysis.theme,
            queryEmbedding,
            0.4, // Lower threshold for more results
            15,  // Get more results
            queryAnalysis.timeframe.startDate,
            queryAnalysis.timeframe.endDate
          );
          
          if (themeResults && themeResults.length > 0) {
            similarEntries = themeResults;
          } else {
            // Fallback to text search
            console.log("No theme results, trying text search");
            
            diagnostics.searchAttempts.push({
              type: 'text_search_fallback',
              keywords: ['work', 'office', 'job']
            });
            
            const textResults = await searchJournalEntriesByText(
              userId,
              "work", // Use "work" as a fallback search term
              10
            );
            
            if (textResults && textResults.length > 0) {
              similarEntries = textResults;
            }
          }
        } catch (error) {
          console.log("Exception occurred, falling back to standard similarity search");
          console.error("Exception in theme search:", error);
          
          try {
            console.log(`Falling back to vector similarity search`);
            
            diagnostics.searchAttempts.push({
              type: 'vector_similarity_fallback',
              threshold: 0.35
            });
            
            const fallbackResults = await searchJournalEntriesWithDate(
              userId,
              queryEmbedding,
              queryAnalysis.timeframe.startDate,
              queryAnalysis.timeframe.endDate,
              0.35,
              15
            );
            
            if (fallbackResults && fallbackResults.length > 0) {
              similarEntries = fallbackResults;
            }
          } catch (fallbackError) {
            console.error("Error in fallback search:", fallbackError);
          }
        }
      } else {
        // For general or temporal queries, use standard vector similarity
        console.log("Using standard similarity search");
        
        diagnostics.searchAttempts.push({
          type: 'vector_similarity',
          threshold: 0.4,
          temporal: queryAnalysis.timeframe.timeType !== null
        });
        
        try {
          console.log(`Calling vector similarity search with userId: ${userId}`);
          
          const vectorResults = await searchJournalEntriesWithDate(
            userId,
            queryEmbedding,
            queryAnalysis.timeframe.startDate,
            queryAnalysis.timeframe.endDate,
            0.35, // Lower threshold for more results
            15    // Get more results
          );
          
          if (vectorResults && vectorResults.length > 0) {
            similarEntries = vectorResults;
          }
        } catch (error) {
          console.error("Error in standard similarity search:", error);
          
          // Try text search as a fallback
          console.log("Trying text search as a fallback");
          
          diagnostics.searchAttempts.push({
            type: 'text_search_fallback',
            error: error.message
          });
          
          try {
            // Extract key terms from the query
            const words = message.toLowerCase().split(/\s+/);
            const keyTerms = words.filter(word => 
              word.length > 3 && !['what', 'when', 'where', 'with', 'that', 'this', 'have', 'from', 'your'].includes(word)
            ).slice(0, 2);
            
            if (keyTerms.length > 0) {
              console.log(`Trying text search with key terms: ${keyTerms.join(', ')}`);
              
              const textResults = await searchJournalEntriesByText(
                userId,
                keyTerms[0],
                10
              );
              
              if (textResults && textResults.length > 0) {
                similarEntries = textResults;
              }
            }
          } catch (textError) {
            console.error("Error in text search fallback:", textError);
          }
        }
      }
    }

    // If no results found, get recent entries as a fallback
    if (similarEntries.length === 0) {
      console.log("No similar entries found, falling back to recent entries");
      
      diagnostics.searchAttempts.push({
        type: 'recent_entries',
        count: 3
      });
      
      try {
        const recentEntries = await getRecentEntries(userId, 3);
        if (recentEntries && recentEntries.length > 0) {
          similarEntries = recentEntries;
        }
      } catch (error) {
        console.error("Error fetching recent entries:", error);
      }
    }

    diagnostics.timings.search = Date.now() - searchStartTime;
    diagnostics.resultsFound = similarEntries.length;

    // Build context from found entries
    const contextStartTime = Date.now();
    let journalContext = "";
    let references = [];

    if (similarEntries.length > 0) {
      console.log(`Found ${similarEntries.length} relevant entries`);
      
      // Sort entries by relevance and date
      similarEntries.sort((a, b) => {
        // Prioritize similarity if available
        if (a.similarity && b.similarity) {
          return b.similarity - a.similarity;
        }
        // Fall back to date-based sorting
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Prepare references and context
      references = similarEntries.map(entry => ({
        id: entry.id,
        date: entry.created_at,
        snippet: entry.content?.substring(0, 150) + "...",
        similarity: entry.similarity || null,
        type: entry.type || 'similarity_match',
        themes: entry.themes || null,
        emotions: entry.emotions || null
      }));

      // Build context differently based on query type
      if (queryAnalysis.queryType === 'thematic' && queryAnalysis.theme) {
        journalContext = `Here are your journal entries related to ${queryAnalysis.theme}:\n\n` +
          similarEntries.map((entry, i) => 
            `Entry ${i+1} (${new Date(entry.created_at).toLocaleDateString()}):\n${entry.content}`
          ).join('\n\n');
      } else if (queryAnalysis.queryType === 'emotional' && queryAnalysis.emotion) {
        journalContext = `Here are your journal entries related to feeling ${queryAnalysis.emotion}:\n\n` +
          similarEntries.map((entry, i) => 
            `Entry ${i+1} (${new Date(entry.created_at).toLocaleDateString()}):\n${entry.content}`
          ).join('\n\n');
      } else {
        journalContext = `Here are some relevant entries from your journal:\n\n` +
          similarEntries.map((entry, i) => 
            `Entry ${i+1} (${new Date(entry.created_at).toLocaleDateString()}):\n${entry.content}`
          ).join('\n\n');
      }
    } else {
      console.log("No relevant entries found");
      journalContext = "I couldn't find any relevant entries in your journal for this query.";
    }

    diagnostics.timings.context = Date.now() - contextStartTime;

    // Get previous messages for context preservation
    const previousMessages = await getPreviousMessages(threadId);
    const conversationHistory = previousMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    console.log("Fetching previous messages for conversation context...");
    console.log(`Retrieved ${previousMessages.length} previous messages`);

    // Prepare system prompt with context
    const systemPrompt = `You are SOULo, an AI assistant that helps users understand their journal entries.
${journalContext}

Based on the above context (if available) and the user's question, provide a thoughtful, personalized response.
Keep your tone warm and conversational. If you notice patterns or insights, mention them gently.

If I couldn't find any relevant entries in the journal, make sure to tell the user "Sorry, looks like we couldn't find any such reference in your journal entries."`;

    // Prepare messages array with conversation history
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if available
    if (conversationHistory.length > 0) {
      console.log("Including previous conversation context");
      messages.push(...conversationHistory);
    }

    // Add the current user message
    messages.push({ role: 'user', content: message });

    // Send to GPT with context and conversation history
    console.log("Sending to GPT with RAG context and conversation history...");
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from GPT API:', errorText);
      throw new Error(`Failed to get response from GPT: ${errorText}`);
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log("AI response generated successfully");
    
    diagnostics.timings.total = Date.now() - startTime;

    // Store the chat message if we have a thread
    if (threadId) {
      await supabase
        .from('chat_messages')
        .insert([
          {
            thread_id: threadId,
            content: message,
            sender: 'user'
          },
          {
            thread_id: threadId,
            content: aiResponse,
            sender: 'assistant',
            reference_entries: references
          }
        ]);
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        references,
        diagnostics,
        functionExecutions
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    diagnostics.timings.total = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        error: error.message,
        response: "Sorry, I encountered an error processing your request. Please try again.",
        diagnostics,
        functionExecutions
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
