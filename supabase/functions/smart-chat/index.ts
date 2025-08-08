import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Import auth utilities
import { getAuthenticatedContext } from '../_shared/auth.ts';

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define CORS headers directly in the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum number of previous messages to include for context
const MAX_CONTEXT_MESSAGES = 10;

// Mental health and wellbeing term dictionary for domain recognition
const MENTAL_HEALTH_TERMS = [
  // Emotional states
  'anxiety', 'anxious', 'depression', 'depressed', 'stress', 'stressed',
  'mood', 'emotion', 'feeling', 'mental health', 'wellbeing', 'well-being',
  'therapy', 'therapist', 'counseling', 'psychiatrist', 'psychologist',
  // Common concerns
  'sleep', 'insomnia', 'tired', 'exhaustion', 'burnout', 'overwhelm', 
  'overthinking', 'ruminating', 'worry', 'worrying', 'trauma',
  // Self-improvement
  'self-care', 'self care', 'mindfulness', 'meditation', 'breathing',
  'coping', 'cope', 'healing', 'recovery', 'growth', 'improve',
  // Relationships
  'relationship', 'friendship', 'family', 'partner', 'work-life',
  'balance', 'boundaries', 'communication',
  // Actions and requests
  'help me', 'advice', 'suggestion', 'recommend', 'strategy', 'technique',
  'improve', 'better', 'healthier', 'calm', 'relax', 'peace'
];

// Define the general question prompt with enhanced mental health awareness
const GENERAL_QUESTION_PROMPT = `You are a mental health assistant of a voice journaling app called "SOuLO". Here's a query from a user. Respond like a chatbot. IF it concerns introductory messages or greetings, respond accordingly. If it concerns general curiosity questions related to mental health, journaling or related things, respond accordingly. If it contains any other abstract question like "Who is the president of India" , "What is quantum physics" or anything that doesn't concern the app's purpose, feel free to deny politely.

For mental health related questions that don't specifically mention the user's personal journal entries, provide helpful general guidance but suggest that for personalized insights, you could analyze their journal entries if they'd like.

**FORMATTING REQUIREMENTS:**
- Use **bold text** for important points and emphasis
- Use *italics* for gentle emphasis and emotional validation
- Create proper paragraph breaks with empty lines between paragraphs
- Use bullet points (•) for lists and key insights
- Use numbered lists (1., 2., 3.) for steps or sequences
- Add appropriate line spacing for readability
- Use ## headers for main sections when providing structured responses
- Include relevant emojis sparingly for warmth and connection (💙, 🌱, ✨)
- Format your response in proper markdown for optimal rendering`;

// Define the journal-specific prompt with enhanced mental health focus
const JOURNAL_SPECIFIC_PROMPT = `You are SOuLO — a voice journaling assistant that helps users reflect, find patterns, and grow emotionally. Use only the journal entries below to inform your response. Do not invent or infer beyond them.

Journal excerpts:
{journalData}
(Spanning from {startDate} to {endDate})

User's question: "{userMessage}"

Guidelines:
1. **Only use facts** from journal entries — no assumptions, no hallucinations.
2. **Tone**: Supportive, clear, and emotionally aware. Avoid generic advice.
3. **Data-grounded**: Back insights with bullet points referencing specific dates/events.
4. **Insightful & Brief**: Spot emotional patterns or changes over time.
5. **Structure**: Use bullets, bold headers, and short sections for easy reading.
6. **Mental Health Focus**: For queries about mental wellbeing, be especially thoughtful, supportive and personalized.
7. **When data is insufficient**, say so clearly and gently suggest journaling directions.

**FORMATTING REQUIREMENTS:**
- Use **bold text** for important insights and key findings
- Use *italics* for emotional validation and gentle emphasis
- Create proper paragraph breaks with empty lines between sections
- Use bullet points (•) for patterns, insights, and key observations
- Use numbered lists (1., 2., 3.) for sequential insights or recommendations
- Use ## headers for main sections in longer responses
- Add appropriate line spacing between different topics
- Include relevant emojis sparingly for emotional connection (💙, 🌱, ✨, 💭)
- Format response in proper markdown syntax for optimal frontend rendering

Keep response concise (max ~150 words), personalized, and well-structured with proper markdown formatting.`;

/**
 * Detect if a message is likely a mental health query requiring journal data
 */
function detectMentalHealthQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check for personal indicators combined with mental health terms
  const hasPersonalIndicators = /\b(i|me|my|mine|myself|we|our|us)\b/i.test(lowerMessage);
  
  // Check if any mental health term appears in the query
  const hasMentalHealthTerms = MENTAL_HEALTH_TERMS.some(term => 
    lowerMessage.includes(term.toLowerCase())
  );
  
  // Check for direct requests for help or advice
  const isHelpRequest = /\b(help|advice|suggest|recommend|improve|better)\b/i.test(lowerMessage);
  
  // Check for questions about feelings or emotional states
  const isEmotionalQuery = /\b(feel|feeling|felt|emotion|mood|happy|sad|angry|anxious)\b/i.test(lowerMessage);
  
  // If it contains personal indicators AND mental health terms OR emotional content, classify as mental_health
  if ((hasPersonalIndicators && (hasMentalHealthTerms || isEmotionalQuery)) || 
      (isHelpRequest && (hasMentalHealthTerms || isEmotionalQuery))) {
    return true;
  }
  
  return false;
}

// New function for query planning
async function planQuery(supabase, query) {
  try {
    console.log("Planning query execution for:", query);
    
    // Get database schema information for context
    const tables = ['Journal Entries', 'chat_messages', 'chat_threads', 'emotions', 'journal_embeddings'];
    let dbSchemaContext = '';
    
    for (const table of tables) {
      const { data, error } = await supabase.rpc('check_table_columns', { table_name: table });
      if (error) {
        console.error(`Error getting schema for ${table}:`, error);
        continue;
      }
      
      dbSchemaContext += `Table: ${table}\nColumns: ${data.map(col => `${col.column_name} (${col.data_type})`).join(', ')}\n\n`;
    }
    
    // Get available functions for context
    const functionsContext = `
    Available functions:
    - match_journal_entries_fixed: Vector similarity search on journal entries
    - match_journal_entries_with_date: Vector similarity search with date filtering
    - match_journal_entries_by_emotion: Find entries with specific emotions
    - match_journal_entries_by_theme: Find entries with specific themes
    - get_top_emotions: Get most frequent emotions in a time period
    - get_top_emotions_with_entries: Get top emotions with sample journal entries
    `;
    
    // Send to OpenAI for planning
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a task planning assistant in a voice journaling app. A user has asked a question related to their journal entries. Your job is to break this question into smaller, logical analysis steps or sub-queries (limit the sub-queries to a maximum of 3), if required, or feel free to return original query as is if it can be answered without this complex breakdown of original query.

Each step/sub-query should:
- Be specific and focused on a single aspect of the analysis
- Map to an available backend function (like emotion tracking, sentiment analysis, theme detection, etc.)
- Include the parameters required to execute that function
- Use available metadata such as dates, goal tags, or emotions if mentioned
- Aim to generate both qualitative and quantitative insights for synthesis

Your response should be a list of clearly named steps that a downstream orchestrator can use to call analysis functions and finally synthesize a response for the user.

Important rules:
- Don't generate results, only generate the analysis plan
- Do not reference journal entries directly
- Skip the plan if the user question is unrelated to journaling
- Output ONLY the queries, one per line, with no extra text or explanation

Database Schema:
${dbSchemaContext}

${functionsContext}

The user asked: "${query}"

Now generate a breakdown of steps using the available tools, database schema and column fields.`
          }
        ],
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error in query planning:", error);
      return [query]; // Fall back to original query
    }

    const result = await response.json();
    const planText = result.choices[0]?.message?.content || '';
    
    // Parse the response into individual sub-queries
    const subQueries = planText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log("Generated sub-queries:", subQueries);
    
    // If no sub-queries or just one, use the original query
    if (subQueries.length <= 1) {
      return [query];
    }
    
    // Limit to max 3 sub-queries
    return subQueries.slice(0, 3);
  } catch (error) {
    console.error("Error planning query execution:", error);
    return [query]; // Fall back to original query
  }
}

// New function to process a single sub-query
async function processSubQuery(subQuery, supabase, userId, timeRange) {
  console.log(`Processing sub-query: ${subQuery}`);
  
  // Generate embedding for the sub-query
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: subQuery,
      encoding_format: 'float'
    }),
  });

  if (!embeddingResponse.ok) {
    const error = await embeddingResponse.text();
    console.error('Failed to generate embedding for sub-query:', error);
    throw new Error(`Failed to generate embedding for sub-query: ${error}`);
  }

  const embeddingData = await embeddingResponse.json();
  const queryEmbedding = embeddingData.data[0].embedding;
  
  // Search for relevant entries
  let entries = [];
  if (timeRange && (timeRange.startDate || timeRange.endDate)) {
    entries = await searchEntriesWithTimeRange(supabase, userId, queryEmbedding, timeRange);
  } else {
    entries = await searchEntriesWithVector(supabase, userId, queryEmbedding);
  }
  
  if (entries.length === 0) {
    return {
      query: subQuery,
      response: "I couldn't find any journal entries related to this specific aspect of your question."
    };
  }
  
  // Format entries for the prompt
  const entriesWithDates = entries.map(entry => {
    const formattedDate = new Date(entry.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    let entityInfo = '';
    if (entry.entities && Array.isArray(entry.entities)) {
      const entityTypes = {};
      entry.entities.forEach(entity => {
        if (!entityTypes[entity.type]) {
          entityTypes[entity.type] = [];
        }
        entityTypes[entity.type].push(entity.name);
      });
      
      const entityStrings = [];
      for (const [type, names] of Object.entries(entityTypes)) {
        entityStrings.push(`${type}: ${names.join(', ')}`);
      }
      if (entityStrings.length > 0) {
        entityInfo = `\nMentioned: ${entityStrings.join(' | ')}`;
      }
    }

    const sentimentInfo = entry.sentiment 
      ? `\nSentiment: ${entry.sentiment} (${
          entry.sentiment <= -0.2 ? 'negative' :
          entry.sentiment >= 0.2 ? 'positive' : 'neutral'
        })`
      : '';

    return `- Entry from ${formattedDate}: ${entry.content}${entityInfo}${sentimentInfo}`;
  }).join('\n\n');
  
  // Create a modified prompt specifically for the sub-query
  const subQueryPrompt = JOURNAL_SPECIFIC_PROMPT
    .replace('{journalData}', entriesWithDates)
    .replace('{userMessage}', subQuery);
  
  // Call OpenAI for this sub-query
  const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: subQueryPrompt }],
    }),
  });

  if (!completionResponse.ok) {
    const error = await completionResponse.text();
    console.error(`Failed to get completion for sub-query: ${subQuery}`, error);
    return {
      query: subQuery,
      response: "I encountered an error while analyzing this aspect of your question."
    };
  }

  const completionData = await completionResponse.json();
  const responseContent = completionData.choices[0]?.message?.content || 'I could not generate a response for this aspect.';
  
  return {
    query: subQuery,
    response: responseContent,
    references: entries.map(entry => ({
      id: entry.id,
      date: entry.created_at,
      snippet: entry.content?.substring(0, 150) + (entry.content?.length > 150 ? "..." : ""),
      similarity: entry.similarity
    }))
  };
}

// New function to synthesize multiple sub-query responses
async function synthesizeResponses(originalQuery, subQueries, subQueryResponses) {
  try {
    console.log("Synthesizing responses for query:", originalQuery);
    
    // Format the sub-query outputs for the prompt
    const subQueryOutputsText = subQueryResponses.map((sqr, index) => {
      return `Sub-query ${index + 1}: "${sqr.query}"\nResults: ${sqr.response}\n`;
    }).join('\n');
    
    // Send to OpenAI for synthesis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert journaling assistant helping users reflect on their emotional and mental well-being.

The user asked:
"${originalQuery}"

We have analyzed this using multiple sub-queries, and here are their results:
${subQueryOutputsText}

Your task is to:
1. Synthesize the information from all sub-query outputs into a single, clear, well-structured response
2. Fully address the user's original question, referencing patterns, trends, or insights as needed
3. Combine both **quantitative analysis** (e.g., frequency, trends, scores) and **qualitative interpretation** (e.g., what this means emotionally or behaviorally)
4. Be empathetic and supportive in tone
5. Use short paragraphs or bullet points if needed to enhance readability
6. Avoid repeating content or listing all journal entries unless explicitly asked
7. Present a meaningful takeaway or reflection for the user
8. Do not mention sub-queries or technical function names

Be concise and insightful. Keep the tone conversational, supportive, and emotionally intelligent.`
          }
        ],
        temperature: 0.5
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error in response synthesis:", error);
      return "I'm having trouble synthesizing information from your journal. Could you try asking a more specific question?";
    }

    const result = await response.json();
    const synthesizedResponse = result.choices[0]?.message?.content || '';
    
    console.log("Generated synthesized response:", synthesizedResponse.substring(0, 100) + "...");
    
    return synthesizedResponse;
  } catch (error) {
    console.error("Error synthesizing responses:", error);
    return "I encountered an error while analyzing your journal entries. Please try again with a different question.";
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract authenticated context
    const { supabase, userContext } = await getAuthenticatedContext(req);
    
    // First check if this is a title generation request
    const reqBody = await req.json();
    if (reqBody.generateTitleOnly && reqBody.userId && reqBody.messages) {
      // Special handling for thread title generation
      const { messages, userId } = reqBody;
      
      const titleCompletionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
        }),
      });
      
      if (!titleCompletionResponse.ok) {
        const error = await titleCompletionResponse.text();
        console.error('Failed to generate title:', error);
        throw new Error('Failed to generate title');
      }
      
      const titleData = await titleCompletionResponse.json();
      const title = titleData.choices[0]?.message?.content || 'New Conversation';
      
      return new Response(
        JSON.stringify({ title }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Normal chat processing flow
    const { message, userId, timeRange, threadId, queryPlan } = reqBody;

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    console.log("Time range received:", timeRange);
    console.log("Query plan received:", queryPlan ? JSON.stringify(queryPlan, null, 2) : "No query plan provided");
    
    // Determine if this is a mental health query requiring personalized analysis
    const isMentalHealthQuery = (queryPlan?.domainContext === 'mental_health') || 
                               detectMentalHealthQuery(message);
    
    if (isMentalHealthQuery) {
      console.log("Detected mental health query, forcing journal-specific processing");
    }
    
    // Send an immediate response with processing status for long-running requests
    if (reqBody.acknowledgeRequest) {
      EdgeRuntime.waitUntil(async () => {
        // This will run in the background after response is sent
        console.log("Processing message in background task");
        // Background processing would happen here
      });
      
      return new Response(
        JSON.stringify({ 
          status: "processing",
          message: "Your request is being processed"
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Fetch previous messages from this thread if a threadId is provided
    let conversationContext = reqBody.conversationContext || [];
    if (threadId && conversationContext.length === 0) {
      try {
        console.log(`Retrieving context from thread ${threadId}`);
        const { data: previousMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(MAX_CONTEXT_MESSAGES * 2); // Get more messages than needed to ensure we have message pairs
        
        if (error) {
          console.error('Error fetching thread context:', error);
        } else if (previousMessages && previousMessages.length > 0) {
          // Process messages to create conversation context
          // We need to reverse the messages to get them in chronological order
          const chronologicalMessages = [...previousMessages].reverse();
          
          // Format as conversation context
          conversationContext = chronologicalMessages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
          
          // Limit to the most recent messages to avoid context length issues
          if (conversationContext.length > MAX_CONTEXT_MESSAGES) {
            conversationContext = conversationContext.slice(-MAX_CONTEXT_MESSAGES);
          }
          
          console.log(`Added ${conversationContext.length} previous messages as context`);
        } else {
          console.log("No previous messages found in thread");
        }
      } catch (contextError) {
        console.error('Error processing thread context:', contextError);
      }
    }
    
    // Get local timezone offset for better time-based queries
    const timezoneOffset = reqBody.timezoneOffset || new Date().getTimezoneOffset();
    console.log(`Local timezone offset: ${timezoneOffset} minutes`);
    
    // Check if a query plan was provided
    if (queryPlan) {
      console.log(`Using provided query plan: ${JSON.stringify(queryPlan, null, 2)}`);
    }
    
    // NEW: First categorize if this is a general question or a journal-specific question
    // unless this is a detected mental health query (always set to JOURNAL_SPECIFIC)
    let questionType = isMentalHealthQuery ? "JOURNAL_SPECIFIC" : null;
    
    // Only categorize if we haven't already determined it's a mental health query
    if (!questionType) {
      console.log("Categorizing question type");
      const categorizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a classifier that determines if a user's query is a general question about mental health, greetings, or an abstract question unrelated to journaling (respond with "GENERAL") OR if it's a question seeking insights from the user's journal entries (respond with "JOURNAL_SPECIFIC"). 
              Respond with ONLY "GENERAL" or "JOURNAL_SPECIFIC".
              
              IMPORTANT GUIDELINE: If the query is related to personal mental health, well-being, emotional states, or self-improvement and could benefit from analyzing personal journal data, classify it as "JOURNAL_SPECIFIC" even if it doesn't explicitly mention journals.
              
              Examples:
              - "How are you doing?" -> "GENERAL"
              - "What is journaling?" -> "GENERAL"
              - "Who is the president of India?" -> "GENERAL"
              - "How was I feeling last week?" -> "JOURNAL_SPECIFIC"
              - "What patterns do you see in my anxiety?" -> "JOURNAL_SPECIFIC"
              - "Am I happier on weekends based on my entries?" -> "JOURNAL_SPECIFIC"
              - "Did I mention being stressed in my entries?" -> "JOURNAL_SPECIFIC"
              - "How can I improve my mental health?" -> "JOURNAL_SPECIFIC"
              - "Why do I feel anxious sometimes?" -> "JOURNAL_SPECIFIC"
              - "What helps me sleep better?" -> "JOURNAL_SPECIFIC"
              - "How can I manage stress?" -> "JOURNAL_SPECIFIC"`
            },
            { role: 'user', content: message }
          ],
          temperature: 0.1,
          max_tokens: 10
        }),
      });

      if (!categorizationResponse.ok) {
        const error = await categorizationResponse.text();
        console.error('Failed to categorize question:', error);
        throw new Error('Failed to categorize question');
      }

      const categorization = await categorizationResponse.json();
      questionType = categorization.choices[0]?.message?.content.trim();
      console.log(`Question categorized as: ${questionType}`);
    }

    // If it's a general question, respond directly without journal entry retrieval
    if (questionType === "GENERAL") {
      console.log("Processing as general question, skipping journal entry retrieval");
      
      const generalCompletionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: GENERAL_QUESTION_PROMPT },
            ...(conversationContext.length > 0 ? conversationContext : []),
            { role: 'user', content: message }
          ],
        }),
      });

      if (!generalCompletionResponse.ok) {
        const error = await generalCompletionResponse.text();
        console.error('Failed to get general completion:', error);
        throw new Error('Failed to generate response');
      }

      const generalCompletionData = await generalCompletionResponse.json();
      const generalResponse = generalCompletionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      console.log("General response generated successfully");

      return new Response(
        JSON.stringify({ data: generalResponse }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // If it's a journal-specific question, continue with the enhanced RAG flow
    // 1. Plan the query into sub-queries if needed
    console.log("Processing as journal-specific question");
    const subQueries = queryPlan?.subqueries || [message];
    console.log(`Using ${subQueries.length} sub-queries:`, subQueries);
    
    // If only one sub-query that matches the original query, use standard processing
    if (subQueries.length === 1 && subQueries[0] === message) {
      console.log("Single query matches original, using standard processing");
      
      // 2. Generate embedding for the message
      console.log("Generating embedding for message");
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: message,
          encoding_format: 'float',
        }),
      });

      if (!embeddingResponse.ok) {
        const error = await embeddingResponse.text();
        console.error('Failed to generate embedding:', error);
        throw new Error('Could not generate embedding for the message');
      }

      const embeddingData = await embeddingResponse.json();
      if (!embeddingData.data || embeddingData.data.length === 0) {
        throw new Error('Could not generate embedding for the message');
      }

      const queryEmbedding = embeddingData.data[0].embedding;
      console.log("Embedding generated successfully");

      // 3. Search for relevant entries with proper temporal filtering
      console.log("Searching for relevant entries");
      
      // Use different search function based on whether we have a time range
      let entries = [];
      if (timeRange && (timeRange.startDate || timeRange.endDate)) {
        console.log(`Using time-filtered search with range: ${JSON.stringify(timeRange)}`);
        entries = await searchEntriesWithTimeRange(supabase, userId, queryEmbedding, timeRange);
      } else {
        console.log("Using standard vector search without time filtering");
        entries = await searchEntriesWithVector(supabase, userId, queryEmbedding);
      }
      
      console.log(`Found ${entries.length} relevant entries`);

      // Check if we found any entries for the requested time period
      if (timeRange && (timeRange.startDate || timeRange.endDate) && entries.length === 0) {
        console.log("No entries found for the specified time range");
        
        // Return a friendly message indicating no entries were found
        return new Response(
          JSON.stringify({ 
            data: "Sorry, it looks like you don't have any journal entries for the time period you're asking about.",
            noEntriesForTimeRange: true
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get earliest and latest entry dates
      let earliestDate = null;
      let latestDate = null;
      
      // Format entries for the prompt with dates
      const entriesWithDates = entries.map(entry => {
        const entryDate = new Date(entry.created_at);
        
        // Track earliest and latest dates
        if (!earliestDate || entryDate < earliestDate) {
          earliestDate = entryDate;
        }
        if (!latestDate || entryDate > latestDate) {
          latestDate = entryDate;
        }
        
        const formattedDate = entryDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        
        // Format entities for display if they exist
        let entityInfo = '';
        if (entry.entities && Array.isArray(entry.entities)) {
          const entityTypes = {};
          entry.entities.forEach(entity => {
            if (!entityTypes[entity.type]) {
              entityTypes[entity.type] = [];
            }
            entityTypes[entity.type].push(entity.name);
          });
          
          // Create a readable string of entities
          const entityStrings = [];
          for (const [type, names] of Object.entries(entityTypes)) {
            entityStrings.push(`${type}: ${names.join(', ')}`);
          }
          if (entityStrings.length > 0) {
            entityInfo = `\nMentioned: ${entityStrings.join(' | ')}`;
          }
        }

        // Format sentiment info
        const sentimentInfo = entry.sentiment 
          ? `\nSentiment: ${entry.sentiment} (${
              entry.sentiment <= -0.2 ? 'negative' :
              entry.sentiment >= 0.2 ? 'positive' : 'neutral'
            })`
          : '';

        return `- Entry from ${formattedDate}: ${entry.content}${entityInfo}${sentimentInfo}`;
      }).join('\n\n');

      // Get all the dates of entries as an array
      const entryDates = entries.map(entry => {
        return new Date(entry.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      });
      
      console.log("Available journal entry dates:", JSON.stringify(entryDates, null, 2));
      
      // Format date range for the prompt
      const startDateFormatted = earliestDate ? earliestDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }) : 'unknown date';
      
      const endDateFormatted = latestDate ? latestDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }) : 'unknown date';
      
      const entryDateRange = `Your journal entries span from ${startDateFormatted} to ${endDateFormatted}.`;
      console.log("Entry date range:", entryDateRange);

      // 4. Prepare prompt with updated instructions
      const promptFormatted = JOURNAL_SPECIFIC_PROMPT
        .replace('{journalData}', entriesWithDates)
        .replace('{userMessage}', message)
        .replace('{startDate}', startDateFormatted)
        .replace('{endDate}', endDateFormatted);
        
      // 5. Call OpenAI
      console.log("Calling OpenAI for completion");
      
      // Prepare the messages array with system prompt and conversation context
      const messages = [];
      
      // Add system prompt
      messages.push({ role: 'system', content: promptFormatted });
      
      // Add conversation context if available
      if (conversationContext.length > 0) {
        // Log that we're using conversation context
        console.log(`Including ${conversationContext.length} messages of conversation context`);
        
        // Add the conversation context messages
        messages.push(...conversationContext);
        
        // Add the current user message
        messages.push({ role: 'user', content: message });
      } else {
        // If no context, just use the system prompt
        console.log("No conversation context available, using only system prompt");
      }
      
      const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: conversationContext.length > 0 ? messages : [{ role: 'system', content: promptFormatted }],
        }),
      });

      if (!completionResponse.ok) {
        const error = await completionResponse.text();
        console.error('Failed to get completion:', error);
        throw new Error('Failed to generate response');
      }

      const completionData = await completionResponse.json();
      const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      console.log("Response generated successfully");

      // Validate response for hallucinated dates
      const containsHallucinatedDates = checkForHallucinatedDates(responseContent, entries);
      if (containsHallucinatedDates) {
        console.warn("WARNING: Response contains potentially hallucinated dates!");
        // In a production system, you might want to regenerate or post-process the response
      } else {
        console.log("No hallucinated dates detected in response");
      }

      // Save the sub-queries even for standard processing (where there's only one)
      if (threadId) {
        try {
          // Store the queries in the database
          const { error } = await supabase
            .from('chat_messages')
            .update({
              sub_query1: subQueries[0],
            })
            .eq('thread_id', threadId)
            .eq('sender', 'user')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (error) {
            console.error("Error storing sub-query:", error);
          }
        } catch (updateError) {
          console.error("Error storing sub-query:", updateError);
        }
      }

      // Return the response
      return new Response(
        JSON.stringify({ 
          data: responseContent,
          processingComplete: true,
          references: entries.map(entry => ({
            id: entry.id,
            date: entry.created_at,
            snippet: entry.content?.substring(0, 150) + (entry.content?.length > 150 ? "..." : ""),
            similarity: entry.similarity
          }))
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } else {
      // Process multiple sub-queries and synthesize the results
      console.log(`Processing ${subQueries.length} sub-queries`);
      
      // Save the sub-queries in the database
      if (threadId) {
        try {
          // Store the queries in the database
          const updateData = {};
          subQueries.forEach((query, idx) => {
            if (idx < 3) { // We only have 3 columns
              updateData[`sub_query${idx + 1}`] = query;
            }
          });
          
          const { error } = await supabase
            .from('chat_messages')
            .update(updateData)
            .eq('thread_id', threadId)
            .eq('sender', 'user')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (error) {
            console.error("Error storing sub-queries:", error);
          }
        } catch (updateError) {
          console.error("Error storing sub-queries:", updateError);
        }
      }
      
      // Process each sub-query
      const subQueryResponses = [];
      for (const query of subQueries) {
        try {
          const response = await processSubQuery(query, supabase, userId, timeRange);
          subQueryResponses.push(response);
        } catch (error) {
          console.error(`Error processing sub-query "${query}":`, error);
          subQueryResponses.push({
            query,
            response: "I encountered an error processing this aspect of your question."
          });
        }
      }
      
      // Save the sub-query responses
      if (threadId) {
        try {
          const { error } = await supabase
            .from('chat_messages')
            .update({
              sub_query_responses: subQueryResponses
            })
            .eq('thread_id', threadId)
            .eq('sender', 'user')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (error) {
            console.error("Error storing sub-query responses:", error);
          }
        } catch (updateError) {
          console.error("Error storing sub-query responses:", updateError);
        }
      }
      
      // Synthesize the responses
      const synthesizedResponse = await synthesizeResponses(message, subQueries, subQueryResponses);
      
      // Collect references from all sub-queries
      const allReferences = subQueryResponses
        .filter(sqr => sqr.references)
        .flatMap(sqr => sqr.references)
        // Remove duplicates by entry ID
        .filter((ref, index, self) => 
          index === self.findIndex((r) => r.id === ref.id)
        );
      
      // Return the final synthesized response
      return new Response(
        JSON.stringify({ 
          data: synthesizedResponse,
          processingComplete: true,
          references: allReferences.length > 0 ? allReferences : undefined
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processingComplete: true
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

// Function to check for potentially hallucinated dates in the response
function checkForHallucinatedDates(response, entries) {
  try {
    // Extract all potential dates from the response using regex
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthRegex = new RegExp(`\\b(${months.join('|')})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?\\b`, 'gi');
    const foundDates = response.match(monthRegex) || [];
    
    // Create a set of actual dates from entries
    const actualDates = new Set();
    entries.forEach(entry => {
      const date = new Date(entry.created_at);
      months.forEach(month => {
        // Add various formats of the same date
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        const day = date.getDate();
        const year = date.getFullYear();
        
        actualDates.add(`${monthName} ${day}`);
        actualDates.add(`${monthName} ${day}, ${year}`);
        actualDates.add(`${monthName} ${day}th`);
        actualDates.add(`${monthName} ${day}st`);
        actualDates.add(`${monthName} ${day}nd`);
        actualDates.add(`${monthName} ${day}rd`);
      });
    });
    
    // Check if any found dates are not in the actual dates set
    for (const foundDate of foundDates) {
      // Normalize the found date for comparison
      const normalizedDate = foundDate.replace(/(?:st|nd|rd|th)/, '').replace(/\s+/g, ' ').trim();
      
      // Extract just month and day for partial matching
      const parts = normalizedDate.split(' ');
      if (parts.length >= 2) {
        const monthDay = `${parts[0]} ${parts[1].replace(',', '')}`;
        
        // Check if either the full date or the month+day exists in actual dates
        if (!actualDates.has(normalizedDate) && !actualDates.has(monthDay)) {
          console.warn(`Potential hallucinated date found: ${foundDate}`);
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error checking for hallucinated dates:", error);
    return false; // Default to not blocking the response
  }
}

// Standard vector search without time filtering
async function searchEntriesWithVector(
  supabase: any,
  userId: string, 
  queryEmbedding: any[]
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_fixed',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userId
      }
    );
    
    if (error) {
      console.error(`Error in vector search: ${error.message}`);
      throw error;
    }
    
    // Ensure sentiment and entities are included in the response
    console.log(`Found ${data?.length || 0} entries with vector similarity`);
    return data || [];
  } catch (error) {
    console.error('Error searching entries with vector:', error);
    throw error;
  }
}

// Time-filtered vector search
async function searchEntriesWithTimeRange(
  supabase: any,
  userId: string, 
  queryEmbedding: any[], 
  timeRange: { startDate?: string; endDate?: string }
) {
  try {
    console.log(`Searching entries with time range for userId: ${userId}`);
    console.log(`Time range: from ${timeRange.startDate || 'none'} to ${timeRange.endDate || 'none'}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userId,
        start_date: timeRange.startDate || null,
        end_date: timeRange.endDate || null
      }
    );
    
    if (error) {
      console.error(`Error in time-filtered vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with time-filtered vector similarity`);
    return data || [];
  } catch (error) {
    console.error('Error searching entries with time range:', error);
    throw error;
  }
}
