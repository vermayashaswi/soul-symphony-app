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
      return tracker.fail(new Error('Failed to generate embedding'));
    }

    const result = await response.json();
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
    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        user_id_filter: userId,
        start_date: startDate,
        end_date: endDate
      }
    );

    if (vectorError) {
      console.error("Error in vector similarity search:", vectorError);
      return tracker.fail(vectorError);
    }

    console.log(`Found ${vectorResults?.length || 0} entries through vector similarity`);
    return tracker.succeed(vectorResults);

  } catch (error) {
    console.error("Exception in searchJournalEntriesByTheme:", error);
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
    
    const { data, error } = await supabase.rpc('match_journal_entries_with_date', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    });
    
    if (error) {
      console.error("Error in vector similarity search:", error);
      return tracker.fail(error);
    }
    
    console.log(`Vector similarity search found ${data?.length || 0} entries`);
    return tracker.succeed(data);
  } catch (error) {
    console.error("Exception in searchJournalEntriesWithDate:", error);
    return tracker.fail(error);
  }
}

// Function to analyze query and determine search strategy
function analyzeQuery(text: string): {
  queryType: 'emotional' | 'temporal' | 'thematic' | 'general',
  searchStrategy: string,
  themeKeywords: string[],
  timeframe: {timeType: string | null, startDate: string | null, endDate: string | null}
} {
  const lowerText = text.toLowerCase();
  
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
  let searchStrategy = 'default';

  if (foundWorkplaceKeywords.length > 0) {
    queryType = 'thematic';
    searchStrategy = 'workplace_context';
  } else if (timeframe.timeType) {
    queryType = 'temporal';
    searchStrategy = 'time_based';
  }

  return {
    queryType,
    searchStrategy,
    themeKeywords: foundWorkplaceKeywords,
    timeframe
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
    
    // Analyze query to determine search strategy
    const queryAnalysis = analyzeQuery(message);
    console.log("Query analysis:", JSON.stringify(queryAnalysis));
    
    diagnostics.queryAnalysis = queryAnalysis;
    diagnostics.searchStrategy = queryAnalysis.searchStrategy;

    // Generate embedding for the query
    console.log("Generating embedding for query...");
    const embeddingStartTime = Date.now();
    const queryEmbedding = await generateEmbedding(message);
    diagnostics.timings.embedding = Date.now() - embeddingStartTime;

    let similarEntries = [];
    const searchStartTime = Date.now();

    // Implement search based on query analysis
    if (queryAnalysis.queryType === 'thematic' && queryAnalysis.themeKeywords.length > 0) {
      // For workplace queries, use theme-based search with backup to vector similarity
      diagnostics.searchAttempts.push({
        type: 'theme_based',
        keywords: queryAnalysis.themeKeywords
      });

      for (const keyword of queryAnalysis.themeKeywords) {
        const themeResults = await searchJournalEntriesByTheme(
          userId,
          keyword,
          queryEmbedding,
          0.4, // Lower threshold for more results
          10,  // Get more results
          queryAnalysis.timeframe.startDate,
          queryAnalysis.timeframe.endDate
        );

        if (themeResults && themeResults.length > 0) {
          similarEntries = [...similarEntries, ...themeResults];
        }
      }
    }

    // If no theme results or not a theme query, try vector similarity
    if (similarEntries.length === 0) {
      diagnostics.searchAttempts.push({
        type: 'vector_similarity',
        threshold: 0.4
      });

      const vectorResults = await searchJournalEntriesWithDate(
        userId,
        queryEmbedding,
        queryAnalysis.timeframe.startDate,
        queryAnalysis.timeframe.endDate,
        0.4, // Lower threshold for more results
        10   // Get more results
      );

      if (vectorResults && vectorResults.length > 0) {
        similarEntries = vectorResults;
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
        type: entry.type || 'similarity_match'
      }));

      // Build context differently based on query type
      if (queryAnalysis.queryType === 'thematic') {
        journalContext = `Here are your journal entries related to ${queryAnalysis.themeKeywords.join(', ')}:\n\n` +
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

    // Prepare system prompt with context
    const systemPrompt = `You are SOULo, an AI assistant that helps users understand their journal entries.
${journalContext}

Based on the above context (if available) and the user's question, provide a thoughtful, personalized response.
Keep your tone warm and conversational. If you notice patterns or insights, mention them gently.`;

    // Send to GPT with context
    console.log("Sending to GPT with context...");
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get response from GPT');
    }

    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
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
