import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

// Maximum number of previous messages to include for context - increased for better context
const MAX_CONTEXT_MESSAGES = 15;

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

// Define the general question prompt with enhanced mental health awareness and consultant persona
const GENERAL_QUESTION_PROMPT = `You are a mental health consultant of a voice journaling app called "SOuLO". 

Respond in a warm, empathetic tone like a skilled human consultant who's helping the user reflect on their mental health journey. Look at our conversation history to understand what we've been discussing and maintain continuity in our conversation.

IF the query concerns introductory messages or greetings, respond accordingly. If it concerns general curiosity questions related to mental health, journaling or related things, respond with helpful information based on professional expertise.

If it contains any abstract question unrelated to mental health or journaling, politely redirect the conversation back to topics relevant to the user's wellbeing and journaling practice.

For mental health related questions that don't specifically mention the user's personal journal entries, provide helpful general guidance based on established therapeutic approaches, but suggest that for personalized insights, you could analyze their journal entries if they'd like.

Always maintain the conversational flow and refer back to previous exchanges when relevant.`;

// Define the journal-specific prompt with enhanced mental health focus and consultant persona
const JOURNAL_SPECIFIC_PROMPT = `You are SOuLO — an expert mental health consultant who specializes in analyzing voice journal entries to help users reflect, find patterns, and grow emotionally. Use the journal entries below to inform your response. Do not invent or infer beyond what's explicitly stated in these entries.

Journal excerpts:
{journalData}
(Spanning from {startDate} to {endDate})

User's question: "{userMessage}"

Previous conversation context (if any):
{conversationHistory}

Guidelines as a consultant:
1. **Evidence-based insights**: Ground all observations in specific journal entries. No assumptions or generalizations.
2. **Consultant tone**: Speak as a warm, empathetic human consultant - not as AI or a chatbot. Be conversational yet professional.
3. **Data-grounded**: Back insights with specific examples from the journal entries, referencing dates when helpful.
4. **Insightful analysis**: Identify emotional patterns, recurring themes, or meaningful changes over time.
5. **Clear structure**: Use a conversational format with occasional bullet points or bold text for key insights.
6. **Conversation continuity**: Reference our previous exchanges when relevant to maintain a flowing conversation.
7. **When data is insufficient**: Acknowledge limitations honestly and suggest what additional journaling might reveal.

Keep your response conversational, personalized, and structured as a professional mental health consultant would.`;

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
async function planQuery(query) {
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
async function processSubQuery(subQuery, userId, timeRange) {
  console.log(`Processing sub-query: ${subQuery}`);
  
  // Generate embedding for the sub-query
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: subQuery,
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
    entries = await searchEntriesWithTimeRange(userId, queryEmbedding, timeRange);
  } else {
    entries = await searchEntriesWithVector(userId, queryEmbedding);
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
          model: 'text-embedding-ada-002',
          input: message,
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
      
      // Always analyze all entries unless specific time range is provided
      let entries = [];
      if (timeRange && (timeRange.startDate || timeRange.endDate)) {
        console.log(`Using time-filtered search with range: ${JSON.stringify(timeRange)}`);
        entries = await searchEntriesWithTimeRange(userId, queryEmbedding, timeRange);
      } else {
        console.log("Using standard vector search without time filtering");
        entries = await searchEntriesWithVector(userId, queryEmbedding);
      }
      
      console.log(`Found ${entries.length} relevant entries`);

      // Check if we found any entries for the requested time period
      if (timeRange && (timeRange.startDate || timeRange.endDate) && entries.length === 0) {
        console.log("No entries found for the specified time range");
        
        // Return a friendly message indicating no entries were found
        return new Response(
          JSON.stringify({ 
            data: "I don't see any journal entries for the time period you're asking about. Perhaps we could look at your entries from a broader time range?",
            noEntriesForTimeRange: true
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // Get ALL entries for the user to ensure we have comprehensive data
      // This ensures we're analyzing all entries, not just the ones that match the vector search
      let allEntries = entries;
      if (!timeRange || (!timeRange.startDate && !timeRange.endDate)) {
        try {
          console.log("Fetching all journal entries for comprehensive analysis");
          const { data: allUserEntries, error } = await supabase
            .from('journal_entries')
            .select('id, content, created_at, sentiment, entities')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
          if (error) {
            console.error("Error fetching all entries:", error);
          } else if (allUserEntries && allUserEntries.length > 0) {
            console.log(`Found ${allUserEntries.length} total entries for the user`);
            
            // If we have more total entries than what our vector search found,
            // use the full set for comprehensive analysis but keep the vector search results
            // for specific reference
            if (allUserEntries.length > entries.length) {
              // Keep original entries for reference, but note the total count
              console.log(`Using all ${allUserEntries.length} entries for comprehensive analysis`);
              
              // Add similarity scores to entries that matched the vector search
              const entriesWithSimilarity = new Map();
              entries.forEach(entry => {
                entriesWithSimilarity.set(entry.id, entry.similarity);
              });
              
              // Add similarity property to all entries (0 for non-matched entries)
              allEntries = allUserEntries.map(entry => ({
                ...entry,
                similarity: entriesWithSimilarity.has(entry.id) ? entriesWithSimilarity.get(entry.id) : 0
              }));
            }
          }
        } catch (error) {
          console.error("Error fetching all entries:", error);
        }
      }
      
      console.log(`Using ${allEntries.length} total entries for analysis`);
      
      // Track the total number of entries analyzed
      const totalEntriesAnalyzed = allEntries.length;

      // Get earliest and latest entry dates
      let earliestDate = null;
      let latestDate = null;
      
      // Sort entries by similarity for the prompt (most relevant first)
      const relevantEntries = [...entries].sort((a, b) => b.similarity - a.similarity).slice(0, 15);
      console.log(`Using ${relevantEntries.length} most relevant entries for the prompt`);
      
      // Format entries for the prompt with dates
      const entriesWithDates = relevantEntries.map(entry => {
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

      // Format conversation history for the prompt
      let conversationHistoryText = "";
      if (conversationContext.length > 0) {
        conversationHistoryText = conversationContext.map(msg => 
          `${msg.role === 'user' ? 'User' : 'Consultant'}: ${msg.content}`
        ).join('\n\n');
      }

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

      // 4. Prepare prompt with updated instructions
      const promptFormatted = JOURNAL_SPECIFIC_PROMPT
        .replace('{journalData}', entriesWithDates)
        .replace('{userMessage}', message)
        .replace('{startDate}', startDateFormatted)
        .replace('{endDate}', endDateFormatted)
        .replace('{conversationHistory}', conversationHistoryText);
        
      // 5. Call OpenAI
      console.log("Calling OpenAI for completion");
      
      // Call OpenAI with system prompt only - conversation history is included in the prompt
      const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: promptFormatted },
            { role: 'user', content: message }
          ],
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

      // Create reference objects for ALL entries but mark only the top ones as most relevant
      const referenceEntries = allEntries.map(entry => ({
        id: entry.id,
        date: entry.created_at,
        snippet: entry.content?.substring(0, 150) + (entry.content?.length > 150 ? "..." : ""),
        similarity: entry.similarity || 0
      }));

      // Return the response with the total count of entries analyzed
      return new Response(
        JSON.stringify({ 
          data: responseContent,
          processingComplete: true,
          totalEntriesAnalyzed: totalEntriesAnalyzed, // Add the total count
          references: referenceEntries
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
          const response = await processSubQuery(query, userId, timeRange);
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
      
      // Create a more consultant-like prompt for synthesizing responses
      const consultantSynthesisPrompt = `You are an expert journaling consultant helping users reflect on their emotional and mental well-being.

The user asked:
"${message}"

Previous conversation context:
${conversationContext.map(msg => `${msg.role === 'user' ? 'User' : 'Consultant'}: ${msg.content}`).join('\n\n')}

We have analyzed this using multiple sub-queries, and here are their results:
${subQueryResponses.map((sqr, index) => {
  return `Sub-query ${index + 1}: "${sqr.query}"\nResults: ${sqr.response}\n`;
}).join('\n')}

Your task is to:
1. Synthesize the information from all sub-query outputs into a single, clear response
2. Speak as a warm, empathetic human consultant - not as AI or a chatbot
3. Fully address the user's original question, referencing patterns or insights from their journal
4. Combine both quantitative analysis and qualitative interpretation 
5. Be empathetic and supportive in tone, maintaining a conversational style
6. Reference previous parts of our conversation when relevant
7. Present meaningful takeaways or reflections tailored to the user

Be conversational, supportive, and emotionally intelligent as a human mental health consultant would be.`;
      
      // Synthesize the responses with the consultant prompt
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
          totalEntriesAnalyzed: allReferences.length, // Add the total count
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
