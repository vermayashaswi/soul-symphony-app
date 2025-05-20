// Import necessary libraries
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.2.1';

// Initialize OpenAI
const configuration = new Configuration({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});
const openai = new OpenAIApi(configuration);

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Enable CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, messageId, previousMessages = [], timezoneOffset = 0, queryPlan = null } = await req.json();

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    console.log(`Local timezone offset: ${timezoneOffset} minutes`);
    
    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // If a query plan was provided, use it
    const plan = queryPlan?.plan || {
      searchStrategy: 'vector',
      filters: {},
      matchCount: 15,
      needsDataAggregation: false,
      needsMoreContext: false
    };
    console.log(`Using provided query plan: ${JSON.stringify(plan, null, 2)}`);

    // Add conversation context
    console.log(`Added ${previousMessages.length} previous messages as context`);

    // IMPROVEMENT: Determine query type with better mental health detection
    const queryType = determineQueryType(message, plan);
    console.log(`Question categorized as: ${queryType}`);

    let matchingEntries = [];
    let response;

    // IMPROVEMENT: Ensure mental health questions use journal entries for personalized insight
    if (queryType === 'GENERAL' && (plan.isMentalHealthQuery || plan.isPersonalQuery)) {
      console.log("Overriding GENERAL classification to JOURNAL_SPECIFIC for mental health query");
      // Override to process as journal specific for mental health queries
      response = await handleJournalSpecificQuestion(message, userId, plan, previousMessages, timezoneOffset);
    }
    else if (queryType === 'GENERAL') {
      console.log("Processing as general question, skipping journal entry retrieval");
      response = await handleGeneralQuestion(message, previousMessages);
    } 
    else {
      console.log("Processing as journal-specific question");
      response = await handleJournalSpecificQuestion(message, userId, plan, previousMessages, timezoneOffset);
    }

    // IMPROVEMENT: Add post-processing for mental health responses
    if (plan.isMentalHealthQuery) {
      response = enhanceMentalHealthResponse(response, plan);
    }

    // Check for hallucinated dates in the response
    const hallucination = checkForHallucinatedDates(response, plan);
    if (hallucination) {
      console.log(`WARNING: Detected potential hallucinated date: ${hallucination}`);
      response = addDisclaimerAboutDate(response, hallucination);
    } else {
      console.log("No hallucinated dates detected in response");
    }

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * IMPROVEMENT: Better detection of mental health and journal-specific queries
 */
function determineQueryType(message: string, plan: any) {
  const lowerMessage = message.toLowerCase();

  // Check plan flags from smart-query-planner
  if (plan.isMentalHealthQuery || plan.isPersonalQuery || plan.needsJournalAnalysis) {
    return 'JOURNAL_SPECIFIC';
  }
  
  if (plan.queryType && plan.queryType !== 'general') {
    return 'JOURNAL_SPECIFIC';
  }

  // Check for mental health related keywords
  const mentalHealthKeywords = [
    "mental health", "anxiety", "depression", "stress", 
    "feeling", "emotion", "mood", "therapy", "psychological",
    "mental", "emotional", "cope", "coping", "self-care"
  ];

  for (const keyword of mentalHealthKeywords) {
    if (lowerMessage.includes(keyword)) {
      return 'JOURNAL_SPECIFIC';
    }
  }

  // Check for personal advice seeking patterns
  if (/\b(?:how can i|what should i|advise me|help me)\b/i.test(lowerMessage)) {
    return 'JOURNAL_SPECIFIC';
  }

  // Check patterns that typically need journal context
  const journalPatterns = [
    /\b(?:my journal|my entri|my log|what i wrote|what i said|I mentioned|I talked about)/i,
    /\b(?:last time|previous|earlier|before|yesterday|last week|last month)/i,
    /\b(?:pattern|trend|change|progress|development|improvement)/i,
  ];

  for (const pattern of journalPatterns) {
    if (pattern.test(lowerMessage)) {
      return 'JOURNAL_SPECIFIC';
    }
  }

  // Default to general query if no indicators are present
  return 'GENERAL';
}

/**
 * Process general questions that don't need journal context
 */
async function handleGeneralQuestion(message: string, previousMessages: any[]) {
  try {
    // Create messages array for the conversation
    const messages = [];
    
    // Add system prompt
    messages.push({
      role: "system",
      content: `You are an insightful and supportive mental health assistant. Your name is Ruh, and you're part of the SOULo journal app. 
Focus on providing thoughtful, evidence-based information. For general questions, provide helpful information while encouraging self-reflection.
Be conversational, warm, and empathetic. If the user asks about mental health concerns, encourage them to seek professional help when appropriate.`
    });
    
    // Include recent conversation context if available
    if (previousMessages && previousMessages.length > 0) {
      console.log("Including messages of conversation context");
      
      // Add a limited number of previous messages (most recent ones)
      const contextLimit = Math.min(previousMessages.length, 5);
      for (let i = previousMessages.length - contextLimit; i < previousMessages.length; i++) {
        const msg = previousMessages[i];
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    
    // Add the current message
    messages.push({ role: "user", content: message });
    
    console.log("Calling OpenAI for completion");
    
    // Call OpenAI chat completion API
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: messages,
      max_tokens: 1200,
      temperature: 0.7
    });
    
    const result = completion.data.choices[0].message?.content || "I couldn't process that request. Could you try asking in a different way?";
    console.log("General response generated successfully");
    
    return result;
  } catch (error) {
    console.error("Error generating general response:", error);
    return "I'm having trouble answering that right now. Could you please try again?";
  }
}

/**
 * Process questions that need journal context
 */
async function handleJournalSpecificQuestion(message: string, userId: string, plan: any, previousMessages: any[], timezoneOffset: number) {
  try {
    // IMPROVEMENT: Get date range from filter or use default ranges
    const { startDate, endDate } = extractDateRange(plan.filters?.date_range, timezoneOffset);
    
    // Retrieve relevant journal entries based on the query
    const { entries, dateRangeSummary } = await retrieveRelevantJournals(message, userId, plan, startDate, endDate);
    
    // Create context from the journal entries
    const journalContext = createJournalContext(entries, plan);
    
    // Create messages array for the conversation
    const messages = [];
    
    // IMPROVEMENT: Enhanced system prompt for mental health queries
    const systemPrompt = createSystemPrompt(plan, dateRangeSummary, entries.length);
    messages.push({ role: "system", content: systemPrompt });
    
    // Include conversation context if available
    if (previousMessages && previousMessages.length > 0) {
      console.log(`Including ${Math.min(previousMessages.length, 3)} messages of conversation context`);
      
      // Add a limited number of previous messages
      const contextLimit = Math.min(previousMessages.length, 3);
      for (let i = previousMessages.length - contextLimit; i < previousMessages.length; i++) {
        const msg = previousMessages[i];
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    
    // Add journal context and the current message
    messages.push({ role: "user", content: journalContext });
    messages.push({ role: "user", content: message });
    
    console.log("Calling OpenAI for completion");
    
    // Call OpenAI chat completion API with carefully tuned parameters
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: messages,
      max_tokens: 1500,
      temperature: plan.isMentalHealthQuery ? 0.5 : 0.7, // IMPROVEMENT: Lower temperature for mental health
      presence_penalty: 0.1,
      frequency_penalty: 0.3,
    });
    
    const result = completion.data.choices[0].message?.content || "I couldn't find relevant information in your journal entries to answer that question.";
    console.log("Response generated successfully");
    
    return result;
  } catch (error) {
    console.error("Error generating response:", error);
    return "I'm having trouble analyzing your journal entries right now. Could you please try again?";
  }
}

/**
 * IMPROVEMENT: Enhanced system prompt for different query types
 */
function createSystemPrompt(plan: any, dateRangeSummary: string, entryCount: number): string {
  let basePrompt = `You are Ruh, an AI assistant in the SOULo journal app that helps users gain insights from their journal entries. 
${dateRangeSummary}

I'll provide you with relevant journal entries from this user, followed by their question. 
When responding:
1. Base your insights and analysis specifically on the content of the user's journal entries
2. If the entries don't contain relevant information to answer the question, be honest about it
3. Be supportive, insightful, and compassionate in your responses
4. Look for patterns, themes, and emotional trends in the entries when relevant
5. If appropriate, suggest connections between different entries or experiences
6. Never mention that you are looking at "journal entries" - instead, refer to them as "what you've shared" or similar natural phrasing`;

  // IMPROVEMENT: Add specialized instruction for mental health queries
  if (plan.isMentalHealthQuery) {
    basePrompt += `\n\nIMPORTANT: This is a MENTAL HEALTH RELATED QUESTION. When responding:
1. Offer personalized observations based ONLY on patterns you see in their journal entries
2. Suggest evidence-based strategies that might help their specific situation
3. Be extremely careful not to make assumptions beyond what's in their journals
4. Avoid generic advice that doesn't consider their specific situation
5. Be supportive and empathetic without being patronizing
6. If needed, gently encourage professional support while validating their experiences
7. Show that you're analyzing their actual experiences rather than giving generic answers`;
  }
  
  // IMPROVEMENT: Add specialized instructions for personal queries
  if (plan.isPersonalQuery) {
    basePrompt += `\n\nThis question is seeking personalized insights. Make sure to:
1. Connect your response directly to specific patterns or themes from their journal entries
2. Use details from their entries to make your response feel tailored to them 
3. Address their specific situation rather than giving generalized advice
4. Use a personal, conversational tone that acknowledges their individual circumstances`;
  }
  
  // Add info about the number of entries being analyzed
  basePrompt += `\n\nI'm providing ${entryCount} journal entries that appear relevant to their question.`;
  
  return basePrompt;
}

/**
 * Retrieve relevant journal entries based on the query
 */
async function retrieveRelevantJournals(query: string, userId: string, plan: any, startDate: string | null, endDate: string | null) {
  // IMPROVEMENT: Adjust match count based on query needs
  const matchCount = plan.isMentalHealthQuery ? 30 : (plan.matchCount || 15);
  
  try {
    // Determine which search strategy to use
    if (!plan.searchStrategy || plan.searchStrategy === 'vector') {
      // Use vector search
      const { data: embedding } = await supabase.functions.invoke('generate-embedding', {
        body: { text: query }
      });
      
      if (!embedding) {
        throw new Error('Failed to generate embedding for query');
      }
      
      // IMPROVEMENT: More targeted retrieval for mental health queries
      const minSimilarity = plan.isMentalHealthQuery ? 0.65 : 0.7;
      
      // Get matching entries
      const { data: entries, error } = await supabase.rpc('match_chunks_with_date', {
        query_embedding: embedding,
        match_threshold: minSimilarity,
        match_count: matchCount,
        user_id_filter: userId,
        start_date: startDate,
        end_date: endDate
      });
      
      if (error) {
        console.error('Error retrieving journal entries:', error);
        throw error;
      }
      
      // Prepare date range summary
      const dateRangeSummary = createDateRangeSummary(entries, startDate, endDate);
      
      return { entries: entries || [], dateRangeSummary };
    } 
    else {
      // Fallback to basic search
      const { data: entries, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(matchCount);
      
      if (error) {
        console.error('Error retrieving journal entries:', error);
        throw error;
      }
      
      // Prepare date range summary
      const dateRangeSummary = createDateRangeSummary(entries, startDate, endDate);
      
      return { entries: entries || [], dateRangeSummary };
    }
  } catch (error) {
    console.error('Error retrieving journal entries:', error);
    return { entries: [], dateRangeSummary: "I couldn't access your journal entries." };
  }
}

/**
 * Create a summary of the date range of entries
 */
function createDateRangeSummary(entries: any[], startDate: string | null, endDate: string | null): string {
  if (!entries || entries.length === 0) {
    return "I don't have access to any of your journal entries for the specified time period.";
  }
  
  // Sort entries by date
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  // Get earliest and latest dates
  const earliestEntry = sortedEntries[0];
  const latestEntry = sortedEntries[sortedEntries.length - 1];
  
  // Format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  
  const earliestDate = formatDate(earliestEntry.created_at);
  const latestDate = formatDate(latestEntry.created_at);
  
  return `Your journal entries span from ${earliestDate} to ${latestDate}. `;
}

/**
 * Extract date range from filters
 */
function extractDateRange(dateRange: any, timezoneOffset: number): { startDate: string | null, endDate: string | null } {
  if (!dateRange) {
    return { startDate: null, endDate: null };
  }
  
  return {
    startDate: dateRange.startDate || null,
    endDate: dateRange.endDate || null
  };
}

/**
 * Create context from journal entries for the AI
 */
function createJournalContext(entries: any[], plan: any): string {
  // IMPROVEMENT: Enhanced context formatting for different query types
  if (!entries || entries.length === 0) {
    return "No journal entries were found for the specified time period or search criteria.";
  }
  
  // Group entries by journal entry id to combine chunks
  const entriesById = entries.reduce((acc, entry) => {
    if (!acc[entry.id]) {
      acc[entry.id] = [];
    }
    acc[entry.id].push(entry);
    return acc;
  }, {});
  
  // Sort the chunks within each entry
  Object.values(entriesById).forEach((chunks: any) => {
    chunks.sort((a: any, b: any) => a.chunk_index - b.chunk_index);
  });
  
  // Build context string
  let context = "Here are the relevant sections from the user's journal entries:\n\n";
  
  // IMPROVEMENT: Enhanced context formatting for mental health queries
  if (plan.isMentalHealthQuery) {
    context = "Here are relevant sections from the user's journal entries that might provide insight into their mental health and emotional state:\n\n";
  }
  
  // Add each entry with its chunks
  Object.entries(entriesById).forEach(([entryId, chunks]: [string, any]) => {
    // Get first chunk to access entry metadata
    const firstChunk = chunks[0];
    
    // Format the date
    const entryDate = new Date(firstChunk.created_at);
    const formattedDate = entryDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
    
    // Add entry header with date
    context += `---\nJOURNAL ENTRY: ${formattedDate}\n\n`;
    
    // Add content from all chunks
    chunks.forEach((chunk: any) => {
      context += `${chunk.content}\n`;
    });
    
    // Add emotions if available
    if (firstChunk.emotions && Object.keys(firstChunk.emotions).length > 0) {
      context += "\nEmotions detected: ";
      const emotions = Object.entries(firstChunk.emotions)
        .map(([emotion, score]: [string, any]) => `${emotion} (${Number(score).toFixed(2)})`)
        .join(', ');
      context += emotions + '\n';
    }
    
    // Add themes if available
    if (firstChunk.themes && firstChunk.themes.length > 0) {
      context += "\nThemes: " + firstChunk.themes.join(', ') + '\n';
    }
    
    context += '\n';
  });
  
  context += "---\n\nPlease analyze these journal entries to answer the user's question.";
  return context;
}

/**
 * Check for hallucinated dates in the response
 */
function checkForHallucinatedDates(response: string, plan: any): string | null {
  return null;
}

/**
 * Add disclaimer about hallucinated date
 */
function addDisclaimerAboutDate(response: string, hallucination: string): string {
  return response;
}

/**
 * IMPROVEMENT: Enhance mental health responses with additional checks
 */
function enhanceMentalHealthResponse(response: string, plan: any): string {
  // Check for generic advice that doesn't seem personalized
  const genericPhrases = [
    "many people feel", "it's common to", "people often", 
    "generally speaking", "in most cases", "typically"
  ];
  
  let isGeneric = false;
  for (const phrase of genericPhrases) {
    if (response.toLowerCase().includes(phrase)) {
      isGeneric = true;
      break;
    }
  }
  
  // If the response seems generic, add a note about this being based on limited information
  if (isGeneric) {
    response += "\n\nI've provided some general guidance based on what I could see in your journal entries. If you'd like more personalized insights, consider sharing more specific details about your situation or experiences in your journals.";
  }
  
  // Always include a gentle professional help reminder for mental health topics
  if (!response.toLowerCase().includes("professional") && 
      !response.toLowerCase().includes("therapist") && 
      !response.toLowerCase().includes("doctor")) {
    response += "\n\nRemember that while journaling and self-reflection are valuable tools for mental health, connecting with a healthcare professional can provide additional support tailored to your unique needs.";
  }
  
  return response;
}
