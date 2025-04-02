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
  matchCount: number = 10, 
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
    
    try {
      // Directly use vector similarity search
      const rpcParams = {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        user_id_filter: userId,
        start_date: startDate,
        end_date: endDate
      };
      
      console.log("RPC params:", JSON.stringify(rpcParams).substring(0, 100) + "...");
      
      const { data: vectorResults, error: vectorError } = await supabase.rpc(
        'match_journal_entries_with_date',
        rpcParams
      );

      if (vectorError) {
        console.error("Error in vector similarity search:", vectorError);
        
        // Try text search as fallback
        console.log("Falling back to text-based search for theme");
        const textSearchTerms = themeQuery.split(/\s+/).filter(w => w.length > 3);
        const searchTerm = textSearchTerms.length > 0 ? textSearchTerms[0] : themeQuery;
        
        const { data: textResults, error: textError } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", created_at')
          .eq('user_id', userId)
          .ilike('refined text', `%${searchTerm}%`)
          .order('created_at', { ascending: false })
          .limit(matchCount);
          
        if (textError) {
          console.error("Error in text search fallback:", textError);
          throw vectorError; // Throw original error if text search also fails
        }
        
        if (textResults && textResults.length > 0) {
          console.log(`Found ${textResults.length} entries through text search fallback`);
          return tracker.succeed(textResults.map(entry => ({
            id: entry.id,
            content: entry["refined text"],
            created_at: entry.created_at,
            similarity: 0.7 // Arbitrary score for text matches
          })));
        }
        
        throw vectorError;
      }

      console.log(`Found ${vectorResults?.length || 0} entries through vector similarity`);
      return tracker.succeed(vectorResults || []);
    } catch (error) {
      console.error("Error in vector similarity search:", error);
      
      // Last resort fallback - get recent entries
      console.log("All searches failed, retrieving recent entries as fallback");
      const { data: recentEntries, error: recentError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(matchCount);
        
      if (recentError) {
        console.error("Error retrieving recent entries:", recentError);
        return tracker.fail(error);
      }
      
      if (recentEntries && recentEntries.length > 0) {
        console.log(`Retrieved ${recentEntries.length} recent entries as fallback`);
        return tracker.succeed(recentEntries.map(entry => ({
          id: entry.id,
          content: entry["refined text"],
          created_at: entry.created_at,
          similarity: 0.4, // Lower score for fallback results
          type: 'recent'
        })));
      }
      
      return tracker.fail(error);
    }
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
  matchCount: number = 10
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
    
    // Prepare RPC parameters
    const rpcParams = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    };
    
    console.log("RPC params for match_journal_entries_with_date:", JSON.stringify(rpcParams).substring(0, 100) + "...");
    
    try {
      const { data, error } = await supabase.rpc(
        'match_journal_entries_with_date',
        rpcParams
      );
      
      if (error) {
        console.error("Error in vector similarity search:", error);
        throw error;
      }
      
      console.log(`Vector similarity search found ${data?.length || 0} entries`);
      return tracker.succeed(data || []);
    } catch (vectorError) {
      console.error("Exception in vector similarity search:", vectorError);
      
      // Fall back to text search if vector search fails
      console.log("Vector search failed, falling back to basic query");
      
      // Try to get entries directly from the Journal Entries table
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(matchCount);
      
      if (fallbackError) {
        console.error("Error in fallback query:", fallbackError);
        return tracker.fail(vectorError); // Return original error
      }
      
      console.log(`Fallback query found ${fallbackData?.length || 0} entries`);
      
      return tracker.succeed((fallbackData || []).map(entry => ({
        id: entry.id,
        content: entry["refined text"],
        created_at: entry.created_at,
        similarity: 0.4, // Lower arbitrary score for fallback results
        type: 'fallback_match'
      })));
    }
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
    
    try {
      // Try using the emotion term RPC function
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
        throw error;
      }
      
      console.log(`Emotion term search found ${data?.length || 0} entries`);
      
      return tracker.succeed((data || []).map(entry => ({
        id: entry.id,
        content: entry.content,
        created_at: entry.created_at,
        similarity: 0.8, // Arbitrary similarity for emotion matches
        type: 'emotion_match'
      })));
    } catch (rpcError) {
      console.error("RPC function error:", rpcError);
      
      // Fallback: query emotions directly in the Journal Entries table
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", created_at, emotions')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit * 3); // Get more entries to filter
      
      if (fallbackError) {
        console.error("Error in fallback emotion query:", fallbackError);
        return tracker.fail(rpcError);
      }
      
      // Filter entries that have the emotion in their emotions JSON field
      const filteredEntries = (fallbackData || []).filter(entry => {
        if (!entry.emotions) return false;
        
        try {
          const emotions = typeof entry.emotions === 'string' 
            ? JSON.parse(entry.emotions) 
            : entry.emotions;
          
          return Object.keys(emotions).some(key => 
            key.toLowerCase().includes(emotionTerm.toLowerCase())
          );
        } catch (e) {
          return false;
        }
      }).slice(0, limit);
      
      console.log(`Fallback emotion search found ${filteredEntries.length} entries`);
      
      return tracker.succeed(filteredEntries.map(entry => ({
        id: entry.id,
        content: entry["refined text"],
        created_at: entry.created_at,
        similarity: 0.7,
        type: 'emotion_fallback_match'
      })));
    }
  } catch (error) {
    console.error("Exception in searchEntriesByEmotionTerm:", error);
    return tracker.fail(error);
  }
}

// New function to search by entity type and name
async function searchEntriesByEntity(
  userId: string,
  entityType: string | null,
  entityName: string | null,
  startDate: string | null = null,
  endDate: string | null = null,
  limit: number = 5
) {
  const tracker = trackFunctionExecution("searchEntriesByEntity", {
    userId,
    entityType,
    entityName,
    startDate,
    endDate,
    limit
  });
  
  try {
    console.log(`Searching for entries with entity. Type: ${entityType}, Name: ${entityName}`);
    
    // Define the basic query conditions
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at, entities')
      .eq('user_id', userId)
      .is('entities', 'not.null');
      
    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    // Execute the query
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error in entity search:", error);
      return tracker.fail(error);
    }
    
    console.log(`Found ${data?.length || 0} entries with entities`);
    
    // Filter entries that have matching entities
    const filteredEntries = data?.filter(entry => {
      if (!entry.entities) return false;
      
      try {
        const entities = Array.isArray(entry.entities) ? entry.entities : [];
        
        return entities.some(entity => {
          // Match by entity type if provided
          const typeMatches = !entityType || entity.type?.toLowerCase().includes(entityType.toLowerCase());
          
          // Match by entity name if provided
          const nameMatches = !entityName || entity.name?.toLowerCase().includes(entityName.toLowerCase());
          
          // Return true if both conditions match or if only checking for one condition
          return typeMatches && nameMatches;
        });
      } catch (e) {
        console.error("Error parsing entities for entry", entry.id, e);
        return false;
      }
    }) || [];
    
    console.log(`Filtered to ${filteredEntries.length} entries with matching entities`);
    
    // Format the results similar to other search functions
    return tracker.succeed(filteredEntries.slice(0, limit).map(entry => ({
      id: entry.id,
      content: entry["refined text"],
      created_at: entry.created_at,
      similarity: 0.85, // High arbitrary similarity for explicit entity matches
      type: 'entity_match',
      entities: entry.entities
    })));
  } catch (error) {
    console.error("Exception in searchEntriesByEntity:", error);
    return tracker.fail(error);
  }
}

// New function to search by both entity and emotion
async function searchEntriesByEntityAndEmotion(
  userId: string,
  entityType: string | null,
  entityName: string | null,
  emotionTerm: string | null,
  startDate: string | null = null,
  endDate: string | null = null,
  limit: number = 5
) {
  const tracker = trackFunctionExecution("searchEntriesByEntityAndEmotion", {
    userId,
    entityType,
    entityName,
    emotionTerm,
    startDate,
    endDate,
    limit
  });
  
  try {
    console.log(`Searching for entries with entity (${entityType}/${entityName}) and emotion (${emotionTerm})`);
    
    // First, get entries matching the entity criteria
    let entityResults = [];
    if (entityType || entityName) {
      entityResults = await searchEntriesByEntity(
        userId,
        entityType,
        entityName,
        startDate,
        endDate,
        limit * 2 // Get more results to filter by emotion
      );
    }
    
    // If we have emotion term and entity results, filter by emotion
    if (emotionTerm && entityResults.length > 0) {
      // Get the IDs of entity-matching entries
      const entityMatchIds = entityResults.map(entry => entry.id);
      
      // Get entries matching the emotion criteria
      const emotionResults = await searchEntriesByEmotionTerm(
        userId,
        emotionTerm,
        startDate,
        endDate,
        limit * 2
      );
      
      // Find entries that match both criteria by ID
      const matchingIds = new Set(emotionResults.map(entry => entry.id));
      const combinedResults = entityResults.filter(entry => matchingIds.has(entry.id));
      
      console.log(`Found ${combinedResults.length} entries matching both entity and emotion criteria`);
      
      if (combinedResults.length > 0) {
        // Enhance the similarity score for dual matches
        return tracker.succeed(combinedResults.slice(0, limit).map(entry => ({
          ...entry,
          similarity: 0.95, // Very high relevance for dual matches
          type: 'entity_emotion_match'
        })));
      }
    }
    
    // If no combined results or no emotion term, return entity results
    if (entityResults.length > 0) {
      return tracker.succeed(entityResults.slice(0, limit));
    }
    
    // If no entity results but have emotion term, get emotion-only results
    if (emotionTerm) {
      const emotionResults = await searchEntriesByEmotionTerm(
        userId,
        emotionTerm,
        startDate,
        endDate,
        limit
      );
      
      if (emotionResults.length > 0) {
        return tracker.succeed(emotionResults);
      }
    }
    
    // As a fallback, get recent entries
    console.log("No matching entries found, falling back to recent entries");
    const recentEntries = await getRecentEntries(userId, limit);
    return tracker.succeed(recentEntries);
    
  } catch (error) {
    console.error("Exception in searchEntriesByEntityAndEmotion:", error);
    return tracker.fail(error);
  }
}

// Function to analyze query and determine search strategy
function analyzeQuery(text: string): {
  queryType: 'emotional' | 'temporal' | 'thematic' | 'entity' | 'entity_emotion' | 'general',
  emotion: string | null,
  theme: string | null,
  entityType: string | null,
  entityName: string | null,
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
  
  // Define entity keywords
  const entityTypeMap = {
    workplace: ['work', 'office', 'job', 'career', 'company', 'business', 'workplace', 'organization'],
    person: ['friend', 'colleague', 'coworker', 'boss', 'manager', 'partner', 'spouse', 'husband', 'wife', 'boyfriend', 'girlfriend'],
    location: ['place', 'city', 'country', 'location', 'home', 'house', 'apartment', 'building'],
    event: ['meeting', 'conference', 'gathering', 'party', 'celebration', 'appointment', 'session'],
    project: ['project', 'task', 'assignment', 'initiative', 'development']
  };
  
  // Check for entity type
  let entityType = null;
  let entityName = null;
  
  for (const [type, keywords] of Object.entries(entityTypeMap)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      entityType = type;
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
  let queryType: 'emotional' | 'temporal' | 'thematic' | 'entity' | 'entity_emotion' | 'general' = 'general';
  let theme = null;

  // Determine if query combines entity and emotion
  if (entityType && emotionFound) {
    queryType = 'entity_emotion';
  } else if (emotionFound) {
    queryType = 'emotional';
  } else if (entityType) {
    queryType = 'entity';
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
    entityType,
    entityName,
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
    embeddingGenerated: false,
    embeddingError: null,
    similaritySearchComplete: false,
    searchError: null,
    contextBuilt: false,
    contextError: null,
    contextSize: 0,
    tokenCount: 0,
    llmError: null,
    timings: {
      total: 0,
      embedding: 0,
      search: 0,
      context: 0
    }
  };

  const startTime = Date.now();

  try {
    const { message, userId, threadId = null, isNewThread = false, threadTitle = null, includeDiagnostics = false, timeframe = null } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Missing required parameters');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Thread ID:", threadId || "new thread");
    console.log("Include diagnostics:", includeDiagnostics ? "yes" : "no");
    
    // Analyze query to determine search strategy
    const queryAnalysis = analyzeQuery(message);
    console.log("Query analysis:", JSON.stringify(queryAnalysis));
    
    // Generate embedding for the query
    console.log("Generating embedding for user query...");
    let queryEmbedding;
    const embeddingStartTime = Date.now();
    
    try {
      queryEmbedding = await generateEmbedding(message);
      diagnostics.embeddingGenerated = true;
      diagnostics.timings.embedding = Date.now() - embeddingStartTime;
    } catch (error) {
      console.error("Error generating embedding:", error);
      diagnostics.embeddingError = error.message || "Failed to generate embedding";
      diagnostics.timings.embedding = Date.now() - embeddingStartTime;
    }

    let similarEntries = [];
    const searchStartTime = Date.now();
    let similarityScores = [];

    // If embedding failed, try alternative search methods
    if (!queryEmbedding) {
      // ... keep existing code (handling for when embedding generation fails)
    } else {
      // If we have an embedding, use it for search based on query analysis
      console.log("Using embedding for search");
      
      // Search strategy based on query analysis
      if (queryAnalysis.queryType === 'entity_emotion') {
        console.log(`Using combined entity and emotion search for ${queryAnalysis.entityType} and ${queryAnalysis.emotion}`);
        
        try {
          const combinedResults = await searchEntriesByEntityAndEmotion(
            userId,
            queryAnalysis.entityType,
            queryAnalysis.entityName,
            queryAnalysis.emotion,
            queryAnalysis.timeframe.startDate,
            queryAnalysis.timeframe.endDate,
            10 // Get more results
          );
          
          if (combinedResults && combinedResults.length > 0) {
            similarEntries = combinedResults;
            diagnostics.similaritySearchComplete = true;
          } else {
            // Fallback to vector similarity
            console.log("No combined entity-emotion results, falling back to vector similarity");
            
            const vectorResults = await searchJournalEntriesWithDate(
              userId,
              queryEmbedding,
              queryAnalysis.timeframe.startDate,
              queryAnalysis.timeframe.endDate,
              0.35, // Lower threshold for more results
              15
            );
            
            if (vectorResults && vectorResults.length > 0) {
              similarEntries = vectorResults;
              diagnostics.similaritySearchComplete = true;
            }
          }
        } catch (error) {
          console.error("Error in combined entity-emotion search:", error);
          diagnostics.searchError = error.message;
          
          // Try vector search as a fallback
          try {
            const vectorResults = await searchJournalEntriesWithDate(
              userId,
              queryEmbedding,
              queryAnalysis.timeframe.startDate,
              queryAnalysis.timeframe.endDate,
              0.35,
              15
            );
            
            if (vectorResults && vectorResults.length > 0) {
              similarEntries = vectorResults;
              diagnostics.similaritySearchComplete = true;
            }
          } catch (vectorError) {
            console.error("Error in fallback vector search:", vectorError);
            // Continue to final fallback
          }
        }
      } else if (queryAnalysis.queryType === 'entity') {
        console.log(`Using entity-based search for ${queryAnalysis.entityType}`);
        
        try {
          const entityResults = await searchEntriesByEntity(
            userId,
            queryAnalysis.entityType,
            queryAnalysis.entityName,
            queryAnalysis.timeframe.startDate,
            queryAnalysis.timeframe.endDate,
            10
          );
          
          if (entityResults && entityResults.length > 0) {
            similarEntries = entityResults;
            diagnostics.similaritySearchComplete = true;
          } else {
            // Fallback to vector similarity
            console.log("No entity results, falling back to vector similarity");
            
            const vectorResults = await searchJournalEntriesWithDate(
              userId,
              queryEmbedding,
              queryAnalysis.timeframe.startDate,
              queryAnalysis.timeframe.endDate,
              0.35,
              15
            );
            
            if (vectorResults && vectorResults.length > 0) {
              similarEntries = vectorResults;
              diagnostics.similaritySearchComplete = true;
            }
          }
        } catch (error) {
          console.error("Error in entity search:", error);
          diagnostics.searchError = error.message;
          
          // Fallback to vector similarity
          try {
            const vectorResults = await searchJournalEntriesWithDate(
              userId,
              queryEmbedding,
              queryAnalysis.timeframe.startDate,
              queryAnalysis.timeframe.endDate,
              0.35,
              15
            );
            
            if (vectorResults && vectorResults.length > 0) {
              similarEntries = vectorResults;
              diagnostics.similaritySearchComplete = true;
            }
          } catch (vectorError) {
            console.error("Error in fallback vector search:", vectorError);
            // Continue to final fallback
          }
        }
      } else if (queryAnalysis.queryType === 'emotional' && queryAnalysis.emotion) {
        // ... keep existing code (emotion-based search)
      } else if (queryAnalysis.queryType === 'thematic' && queryAnalysis.theme) {
        // ... keep existing code (theme-based search)
      } else {
        // ... keep existing code (standard vector similarity search)
      }
    }

    diagnostics.timings.search = Date.now() - searchStartTime;
    diagnostics.similarityScores = similarityScores;

    // If we still have no entries, get recent entries as a fallback
    if (similarEntries.length === 0) {
      console.log("No similar entries found, falling back to recent entries");
      
      try {
        const recentEntries = await getRecentEntries(userId, 3);
        if (recentEntries && recentEntries.length > 0) {
          similarEntries = recentEntries;
          diagnostics.similaritySearchComplete = true;
        }
      } catch (error) {
        console.error("Error fetching recent entries:", error);
        diagnostics.searchError = (diagnostics.searchError || '') + ` Recent fallback: ${error.message}`;
      }
    }

    // Build context from found entries
    const contextStartTime = Date.now();
    let journalContext = "";
    let references = [];

    try {
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
          emotions: entry.emotions || null,
          entities: entry.entities || null
        }));

        // Build context based on query type
        if (queryAnalysis.queryType === 'entity_emotion') {
          journalContext = `Here are your journal entries related to "${queryAnalysis.entityType}" where you felt "${queryAnalysis.emotion}":\n\n` +
            similarEntries.map((entry, i) => 
              `Entry ${i+1} (${new Date(entry.created_at).toLocaleDateString()}):\n${entry.content}`
            ).join('\n\n');
        } else if (queryAnalysis.queryType === 'entity') {
          journalContext = `Here are your journal entries related to "${queryAnalysis.entityType}":\n\n` +
            similarEntries.map((entry, i) => 
              `Entry ${i+1} (${new Date(entry.created_at).toLocaleDateString()}):\n${entry.content}`
            ).join('\n\n');
        } else if (queryAnalysis.queryType === 'thematic' && queryAnalysis.theme) {
          // ... keep existing code (thematic context format)
        } else if (queryAnalysis.queryType === 'emotional' && queryAnalysis.emotion) {
          // ... keep existing code (emotional context format)
        } else {
          // ... keep existing code (general context format)
        }
        
        diagnostics.contextBuilt = true;
        diagnostics.contextSize = journalContext.length;
      } else {
        console.log("No relevant entries found");
        journalContext = "I couldn't find any relevant entries in your journal for this query.";
        diagnostics.contextBuilt = true;
        diagnostics.contextSize = journalContext.length;
      }
    } catch (contextError) {
      console.error("Error building context:", contextError);
      journalContext = "I encountered an error while searching for relevant entries in your journal.";
      diagnostics.contextError = contextError.message;
    }

    diagnostics.timings.context = Date.now() - contextStartTime;

    // Get previous messages for context preservation
    let conversationHistory = [];
    try {
      const previousMessages = await getPreviousMessages(threadId);
      conversationHistory = previousMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      console.log("Fetching previous messages for conversation context...");
      console.log(`Retrieved ${previousMessages.length} previous messages`);
    } catch (historyError) {
      console.error("Error fetching conversation history:", historyError);
    }

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

    // Create a new chat thread if needed
    let activeThreadId = threadId;
    if (isNewThread) {
      try {
        const { data: newThread, error: threadError } = await supabase
          .from('chat_threads')
          .insert({
            user_id: userId,
            title: threadTitle || message.substring(0, 30) + (message.length > 30 ? "..." : "")
          })
          .select('id')
          .single();
        
        if (threadError) {
          console.error("Error creating new thread:", threadError);
        } else if (newThread) {
          console.log(`Created new thread with ID: ${newThread.id}`);
          activeThreadId = newThread.id;
        }
      } catch (threadCreationError) {
        console.error("Exception creating thread:", threadCreationError);
      }
    }

    // Send to GPT with context and conversation history
    console.log("Sending to GPT with RAG context and conversation history...");
    let aiResponse;
    try {
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
      aiResponse = result.choices[0].message.content;
      diagnostics.tokenCount = result.usage ? result.usage.total_tokens : 'unknown';
      
      console.log("AI response generated successfully");
    } catch (llmError) {
      console.error("Error generating LLM response:", llmError);
      diagnostics.llmError = llmError.message;
      
      // Provide a fallback response if LLM fails
      if (similarEntries.length > 0) {
        aiResponse = "I found some potentially relevant entries in your journal, but I'm having trouble analyzing them right now. Please try again in a moment.";
      } else {
        aiResponse = "Sorry, looks like we couldn't find any such reference in your journal entries, and I'm having trouble generating a response. Please try again in a moment.";
      }
    }
    
    diagnostics.timings.total = Date.now() - startTime;

    // Store the chat message if we have a thread
    if (activeThreadId) {
      try {
        await supabase
          .from('chat_messages')
          .insert([
            {
              thread_id: activeThreadId,
              content: message,
              sender: 'user'
            },
            {
              thread_id: activeThreadId,
              content: aiResponse,
              sender: 'assistant',
              reference_entries: references
            }
          ]);
      } catch (storageError) {
        console.error("Error storing chat messages:", storageError);
      }
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        references,
        threadId: activeThreadId,
        queryAnalysis,
        diagnostics,
        similarityScores,
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
