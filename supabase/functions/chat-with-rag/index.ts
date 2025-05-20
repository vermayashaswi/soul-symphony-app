import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0';
import { OpenAI } from "https://esm.sh/openai@4.0.0";
import { analyzeTimePatterns } from "./timePatternAnalyzer.ts";

// Handle CORS for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY') || '',
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Question categories for processing
enum QuestionCategory {
  JOURNAL_SPECIFIC = 'JOURNAL_SPECIFIC',
  GENERAL = 'GENERAL'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      message,
      userId,
      queryPlan,
      threadId,
      usePersonalContext = true,
      conversationHistory = [],
      analyzeTimePatterns: shouldAnalyzeTimePatterns = false,
      timezoneOffset = 0
    } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 30)}...`);
    console.log(`Local timezone offset: ${timezoneOffset} minutes`);

    // Use the provided query plan or create a default one
    const plan = queryPlan || {
      searchStrategy: "vector",
      filters: {},
      matchCount: 15,
      needsDataAggregation: false,
      needsMoreContext: false
    };

    console.log(`Using provided query plan: ${JSON.stringify(plan, null, 2)}`);

    // Add previous messages as context if available
    let contextMessages = [];
    if (conversationHistory && conversationHistory.length > 0) {
      // Limit to last 3 messages for context
      contextMessages = conversationHistory.slice(-3);
      console.log(`Added ${contextMessages.length} previous messages as context`);
    }

    // Determine if this is a question about journaling time patterns
    const isTimePatternQuery = shouldAnalyzeTimePatterns || 
      /\btime of day\b|\bwhen do i\b|\bwhat time\b/i.test(message.toLowerCase()) && 
      /\bjournal\b|\blog\b|\bwrite\b|\brecord\b/i.test(message.toLowerCase());

    // Classify the question to determine processing approach
    const questionCategory = usePersonalContext ? QuestionCategory.JOURNAL_SPECIFIC : QuestionCategory.GENERAL;
    console.log(`Question categorized as: ${questionCategory}`);

    // Process based on question category
    if (questionCategory === QuestionCategory.GENERAL) {
      console.log("Processing as general question, skipping journal entry retrieval");
      return await handleGeneralQuestion(message, contextMessages);
    } else {
      // Determine if this is a personality question that needs special handling
      const isPersonalityQuestion = /\b(introvert|extrovert|personality|social|people person)\b/i.test(message);
      
      // Determine if this is a time pattern question
      if (isTimePatternQuery) {
        console.log("Processing as time pattern question, using timestamp analysis");
        return await handleTimePatternQuestion(message, userId, timezoneOffset, contextMessages);
      } else if (isPersonalityQuestion) {
        console.log("Processing as personality question, using specialized handling");
        return await handlePersonalityQuestion(message, userId, contextMessages);
      } else {
        console.log("Processing as standard journal-specific question");
        return await handleJournalQuestion(message, userId, plan, contextMessages);
      }
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * Handle general questions that don't require journal context
 */
async function handleGeneralQuestion(question: string, contextMessages: any[] = []) {
  console.log("Calling OpenAI for completion");
  try {
    const messages = [
      {
        role: "system",
        content: `You are Rūḥ, an AI assistant specializing in mental well-being and journaling.
        Provide thoughtful, evidence-based responses that are supportive and insightful.
        Focus on being helpful, not just informative. Show empathy while maintaining appropriate boundaries.
        Respect that you're not a replacement for professional mental health advice.`
      },
      ...contextMessages.map((msg: any) => ({
        role: msg.role || "user",
        content: msg.content
      })),
      { role: "user", content: question }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const responseContent = completion.choices[0].message.content || "I'm not sure how to respond to that.";

    // Check for hallucinated dates in the response
    if (!detectHallucinatedDates(responseContent)) {
      console.log("No hallucinated dates detected in response");
    }

    return new Response(
      JSON.stringify({
        response: responseContent,
        references: [],
        sources: []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error generating general response:", error);
    return new Response(
      JSON.stringify({
        response: "I apologize, but I'm having trouble processing your request at the moment. Please try again shortly.",
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Handle questions specifically about user's journaling time patterns
 */
async function handleTimePatternQuestion(question: string, userId: string, timezoneOffset: number, contextMessages: any[] = []) {
  console.log("Processing time pattern question");
  try {
    // Fetch all journal entries to analyze timestamps
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching journal entries: ${error.message}`);
    }

    console.log(`Retrieved ${entries?.length || 0} journal entries for time pattern analysis`);

    // Analyze time patterns in the journal entries
    const timeAnalysis = analyzeTimePatterns(entries || [], timezoneOffset);
    
    console.log("Time analysis complete:", JSON.stringify(timeAnalysis.summaryText));

    // Create a prompt that includes the time analysis
    const systemPrompt = `You are Rūḥ, an AI assistant specializing in mental well-being and journaling.
    You're analyzing when the user typically journals based on their entry timestamps.
    
    TIME PATTERN ANALYSIS:
    ${timeAnalysis.summaryText}
    
    Additional details:
    - Most frequent time period: ${timeAnalysis.mostFrequentPeriod} (${timeAnalysis.mostFrequentPercentage}%)
    - Total entries analyzed: ${timeAnalysis.totalEntries}
    - Has sufficient data: ${timeAnalysis.hasSufficientData ? 'Yes' : 'No'}
    
    Time period breakdown:
    ${timeAnalysis.periodFrequencies.map(pf => `- ${pf.period}: ${pf.count} entries (${pf.percentage}%)`).join('\n')}
    
    Respond to the user's question about their journaling time patterns using this analysis.
    Be conversational and personable. If there's insufficient data, be honest about this limitation.
    Do not mention the specific analysis method or technical details about how you analyzed the data.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...contextMessages.map((msg: any) => ({
        role: msg.role || "user",
        content: msg.content
      })),
      { role: "user", content: question }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const responseContent = completion.choices[0].message.content || "I'm not sure how to respond to that.";

    return new Response(
      JSON.stringify({
        response: responseContent,
        references: [],
        analysis: {
          timePatterns: {
            mostFrequentPeriod: timeAnalysis.mostFrequentPeriod,
            mostFrequentPercentage: timeAnalysis.mostFrequentPercentage,
            totalEntries: timeAnalysis.totalEntries,
            periodFrequencies: timeAnalysis.periodFrequencies
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error processing time pattern question:", error);
    return new Response(
      JSON.stringify({
        response: "I apologize, but I'm having trouble analyzing your journaling time patterns at the moment. Please try again shortly.",
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Handle personality-related questions with specialized analysis
 */
async function handlePersonalityQuestion(question: string, userId: string, contextMessages: any[] = []) {
  try {
    // Fetch relevant journal entries for personality analysis
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('id, content, created_at, master_themes, emotions')
      .eq('user_id', userId)
      .ilike('content', `%personality%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Error fetching journal entries: ${error.message}`);
    }

    if (!entries || entries.length === 0) {
      console.log("No relevant journal entries found for personality question");
      return handleGeneralQuestion(question, contextMessages);
    }

    // Format entries for inclusion in the prompt
    const formattedEntries = entries.map((entry, index) => {
      let entryText = `Entry ${index + 1} (${formatDate(entry.created_at)}):\n${entry.content}`;

      // Add themes if available
      if (entry.master_themes && entry.master_themes.length > 0) {
        entryText += `\nThemes: ${entry.master_themes.join(', ')}`;
      }

      // Add emotions if available
      if (entry.emotions && Object.keys(entry.emotions).length > 0) {
        const emotionsList = Object.entries(entry.emotions)
          .sort((a, b) => b[1] - a[1])
          .map(([emotion, score]) => `${emotion} (${Math.round((score as number) * 100)}%)`)
          .slice(0, 3)
          .join(', ');

        entryText += `\nEmotions: ${emotionsList}`;
      }

      return entryText;
    }).join('\n\n');

    const systemPrompt = `You are Rūḥ, an AI assistant specializing in mental well-being and journaling.
    Answer the user's question about their personality based on insights from their journal entries.
    Respond in a supportive, thoughtful manner that helps the user gain insights from their journaling.

    Here are relevant excerpts from the user's journal:

    ${formattedEntries}

    Use specific examples from these entries to support your response. 
    Be conversational and personable, showing that you understand the user's experiences as documented in their journal.
    If the entries don't contain enough information to answer the question confidently, acknowledge this limitation.
    Do not make up information that isn't in the entries.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...contextMessages.map((msg: any) => ({
        role: msg.role || "user",
        content: msg.content
      })),
      { role: "user", content: question }
    ];

    console.log("Calling OpenAI for personality-informed completion");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const responseContent = completion.choices[0].message.content || "I'm not sure how to respond to that.";

    // Format the entries for response references
    const references = entries.map(entry => ({
      id: entry.id,
      content: truncateText(entry.content, 150),
      created_at: entry.created_at,
      similarity: 0 // Not using similarity for personality questions
    }));

    return new Response(
      JSON.stringify({
        response: responseContent,
        references
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error handling personality question:", error);
    return new Response(
      JSON.stringify({
        response: "I'm having trouble analyzing your journal entries right now. Please try again shortly.",
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Handle questions that require journal context
 */
async function handleJournalQuestion(question: string, userId: string, plan: any, contextMessages: any[] = []) {
  try {
    console.log(`Searching for relevant journal entries using strategy: ${plan.searchStrategy}`);
    
    // Get relevant journal entries based on the plan
    const entries = await getRelevantJournalEntries(question, userId, plan);
    
    if (!entries || entries.length === 0) {
      console.log("No relevant journal entries found");
      
      // Offer to search historical data if entries weren't found
      const isTimeConstrainedQuery = plan.filters && plan.filters.date_range;
      if (isTimeConstrainedQuery) {
        return new Response(
          JSON.stringify({
            response: "I couldn't find any relevant journal entries from the time period you mentioned. Would you like me to search through all of your entries?",
            isInteractive: true,
            options: [
              {
                text: "Yes, search all my entries",
                action: "expand_search"
              },
              {
                text: "No, just stick to recent entries",
                action: "default_search"
              }
            ]
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Fall back to general response if no entries found
      return handleGeneralQuestion(question, contextMessages);
    }
    
    console.log(`Found ${entries.length} relevant journal entries`);
    
    // Format entries for inclusion in the prompt
    const formattedEntries = entries.map((entry, index) => {
      let entryText = `Entry ${index + 1} (${formatDate(entry.created_at)}):\n${entry.content}`;
      
      // Add themes if available
      if (entry.themes && entry.themes.length > 0) {
        entryText += `\nThemes: ${entry.themes.join(', ')}`;
      }
      
      // Add emotions if available
      if (entry.emotions && Object.keys(entry.emotions).length > 0) {
        const emotionsList = Object.entries(entry.emotions)
          .sort((a, b) => b[1] - a[1])
          .map(([emotion, score]) => `${emotion} (${Math.round((score as number) * 100)}%)`)
          .slice(0, 3)
          .join(', ');
        
        entryText += `\nEmotions: ${emotionsList}`;
      }
      
      return entryText;
    }).join('\n\n');
    
    const systemPrompt = `You are Rūḥ, an AI assistant specializing in mental well-being and journaling.
    Answer the user's question based on insights from their journal entries.
    Respond in a supportive, thoughtful manner that helps the user gain insights from their journaling.
    
    Here are relevant excerpts from the user's journal:
    
    ${formattedEntries}
    
    Use specific examples from these entries to support your response. 
    Be conversational and personable, showing that you understand the user's experiences as documented in their journal.
    If the entries don't contain enough information to answer the question confidently, acknowledge this limitation.
    Do not make up information that isn't in the entries.`;
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...contextMessages.map((msg: any) => ({
        role: msg.role || "user",
        content: msg.content
      })),
      { role: "user", content: question }
    ];
    
    console.log("Calling OpenAI for journal-informed completion");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const responseContent = completion.choices[0].message.content || "I'm not sure how to respond to that.";
    
    // Format the entries for response references
    const references = entries.map(entry => ({
      id: entry.id,
      content: truncateText(entry.content, 150),
      created_at: entry.created_at,
      similarity: entry.similarity || 0
    }));
    
    return new Response(
      JSON.stringify({
        response: responseContent,
        references
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error handling journal question:", error);
    return new Response(
      JSON.stringify({
        response: "I'm having trouble analyzing your journal entries right now. Please try again shortly.",
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Get relevant journal entries based on the query plan
 */
async function getRelevantJournalEntries(query: string, userId: string, plan: any) {
  try {
    if (plan.searchStrategy === "vector") {
      // Use vector search if specified
      const { data: embedding, error: embeddingError } = await generateEmbedding(query);
      if (embeddingError) {
        console.error("Error generating embedding:", embeddingError);
        throw new Error(`Failed to generate embedding: ${embeddingError}`);
      }
      
      return await searchEntriesWithEmbedding(embedding, userId, plan);
    } else if (plan.searchStrategy === "sql") {
      // Use SQL search if specified
      return await searchEntriesWithSQL(query, userId, plan);
    } else {
      // Default to a simple text search
      return await searchEntriesWithText(query, userId, plan);
    }
  } catch (error) {
    console.error("Error getting relevant journal entries:", error);
    throw error;
  }
}

/**
 * Generate an embedding for the input text
 */
async function generateEmbedding(input: string) {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: input.replace(/\n/g, " ")
    });
    
    return { data: embeddingResponse.data[0].embedding, error: null };
  } catch (error) {
    console.error("Error generating embedding:", error);
    return { data: null, error };
  }
}

/**
 * Search for journal entries using embeddings
 */
async function searchEntriesWithEmbedding(embedding: number[], userId: string, plan: any) {
  try {
    const matchThreshold = 0.7;
    const matchCount = plan.matchCount || 15;
    
    // Determine which function to use based on whether date filtering is needed
    let searchFunction;
    let searchParams;
    
    if (plan.filters && plan.filters.date_range) {
      // Use the date range function
      searchFunction = 'match_journal_entries_with_date';
      searchParams = {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        user_id_filter: userId,
        start_date: plan.filters.date_range.startDate,
        end_date: plan.filters.date_range.endDate
      };
    } else {
      // Use the standard function
      searchFunction = 'match_journal_entries_fixed';
      searchParams = {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        user_id_filter: userId
      };
    }
    
    // Call the appropriate search function
    const { data, error } = await supabase.rpc(
      searchFunction,
      searchParams
    );
    
    if (error) {
      console.error(`Error in vector search using ${searchFunction}:`, error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in vector search:", error);
    throw error;
  }
}

/**
 * Search for journal entries using SQL
 */
async function searchEntriesWithSQL(query: string, userId: string, plan: any) {
  try {
    let entriesQuery = supabase
      .from('Journal Entries')
      .select('id, content, created_at, master_themes, emotions')
      .eq('user_id', userId);
    
    // Apply date range filter if present
    if (plan.filters && plan.filters.date_range) {
      const { startDate, endDate } = plan.filters.date_range;
      
      if (startDate) {
        entriesQuery = entriesQuery.gte('created_at', startDate);
      }
      
      if (endDate) {
        entriesQuery = entriesQuery.lte('created_at', endDate);
      }
    }
    
    // Apply additional filters if needed
    
    // Add ordering and limit
    entriesQuery = entriesQuery
      .order('created_at', { ascending: false })
      .limit(plan.matchCount || 15);
    
    const { data, error } = await entriesQuery;
    
    if (error) {
      console.error("Error in SQL search:", error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in SQL search:", error);
    throw error;
  }
}

/**
 * Search for journal entries using text search
 */
async function searchEntriesWithText(query: string, userId: string, plan: any) {
  try {
    // Implement fallback text search method
    // This can be a simple text match or more complex logic
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, content, created_at, master_themes, emotions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(plan.matchCount || 15);
    
    if (error) {
      console.error("Error in text search:", error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in text search:", error);
    throw error;
  }
}

/**
 * Format a date in a readable format
 */
function formatDate(dateString: string | Date): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'Invalid date';
  }
}

/**
 * Truncate text to a specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  
  if (text.length <= maxLength) {
    return text;
  }
  
  // Find a good breaking point
  const breakPoint = text.lastIndexOf(' ', maxLength);
  
  if (breakPoint > 0) {
    return text.substring(0, breakPoint) + '...';
  }
  
  return text.substring(0, maxLength) + '...';
}

/**
 * Detect potentially hallucinated dates in response content
 */
function detectHallucinatedDates(content: string): boolean {
  // Find parts that mention journal dates
  // This is a simple heuristic and can be improved
  const journalDateReferences = content.match(/your (entry|journal) (from|on|dated) [A-Z][a-z]+ \d{1,2},? \d{4}/g);
  
  if (journalDateReferences && journalDateReferences.length > 0) {
    console.warn("Potential hallucinated dates detected:", journalDateReferences);
    return true;
  }
  
  return false;
}
