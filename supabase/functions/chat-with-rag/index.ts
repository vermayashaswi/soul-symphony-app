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

// Add diagnostic helper function at the beginning of the edge function
function createDiagnosticStep(name: string, status: string, details: any = null) {
  return {
    name,
    status,
    details,
    timestamp: new Date().toISOString()
  };
}

// Define the general question prompt
const GENERAL_QUESTION_PROMPT = `You are a mental health assistant of a voice journaling app called "SOuLO". Here's a query from a user. Respond like a chatbot. IF it concerns introductory messages or greetings, respond accordingly. If it concerns general curiosity questions related to mental health, journaling or related things, respond accordingly. If it contains any other abstract question like "Who is the president of India" , "What is quantum physics" or anything that doesn't concern the app's purpose, feel free to deny politely.`;

// Maximum number of previous messages to include for context
const MAX_CONTEXT_MESSAGES = 10;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      userId, 
      threadId, 
      includeDiagnostics, 
      queryPlan 
    } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    
    // Add this where appropriate in the main request handler:
    const diagnostics = {
      steps: [],
      similarityScores: [],
      functionCalls: [],
      references: []
    };
    
    // Log the query plan if provided
    if (queryPlan) {
      console.log("Using provided query plan:", queryPlan);
      diagnostics.steps.push(createDiagnosticStep(
        "Query Plan", 
        "success", 
        JSON.stringify(queryPlan)
      ));
    }
    
    // Fetch previous messages from this thread if a threadId is provided
    let conversationContext = [];
    if (threadId) {
      diagnostics.steps.push(createDiagnosticStep("Thread Context Retrieval", "loading"));
      try {
        const { data: previousMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(MAX_CONTEXT_MESSAGES * 2); // Get more messages than needed to ensure we have message pairs
        
        if (error) {
          console.error('Error fetching thread context:', error);
          diagnostics.steps.push(createDiagnosticStep("Thread Context Retrieval", "error", error.message));
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
          
          diagnostics.steps.push(createDiagnosticStep(
            "Thread Context Retrieval", 
            "success", 
            `Retrieved ${conversationContext.length} messages for context`
          ));
          
          console.log(`Added ${conversationContext.length} previous messages as context`);
        } else {
          diagnostics.steps.push(createDiagnosticStep(
            "Thread Context Retrieval", 
            "success", 
            "No previous messages found in thread"
          ));
        }
      } catch (contextError) {
        console.error('Error processing thread context:', contextError);
        diagnostics.steps.push(createDiagnosticStep("Thread Context Retrieval", "error", contextError.message));
      }
    }
    
    // First categorize if this is a general question or a journal-specific question
    diagnostics.steps.push(createDiagnosticStep("Question Categorization", "loading"));
    console.log("Categorizing question type");
    const categorizationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a classifier that determines if a user's query is a general question about mental health, greetings, or an abstract question unrelated to journaling (respond with "GENERAL") OR if it's a question seeking insights from the user's journal entries (respond with "JOURNAL_SPECIFIC"). 
            Respond with ONLY "GENERAL" or "JOURNAL_SPECIFIC".
            
            Examples:
            - "How are you doing?" -> "GENERAL"
            - "What is journaling?" -> "GENERAL"
            - "Who is the president of India?" -> "GENERAL"
            - "How was I feeling last week?" -> "JOURNAL_SPECIFIC"
            - "What patterns do you see in my anxiety?" -> "JOURNAL_SPECIFIC"
            - "Am I happier on weekends based on my entries?" -> "JOURNAL_SPECIFIC"
            - "Did I mention being stressed in my entries?" -> "JOURNAL_SPECIFIC"`
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
      diagnostics.steps.push(createDiagnosticStep("Question Categorization", "error", error));
      throw new Error('Failed to categorize question');
    }

    const categorization = await categorizationResponse.json();
    const questionType = categorization.choices[0]?.message?.content.trim();
    console.log(`Question categorized as: ${questionType}`);
    diagnostics.steps.push(createDiagnosticStep("Question Categorization", "success", `Classified as ${questionType}`));

    // If it's a general question, respond directly without journal entry retrieval
    if (questionType === "GENERAL") {
      console.log("Processing as general question, skipping journal entry retrieval");
      diagnostics.steps.push(createDiagnosticStep("General Question Processing", "loading"));
      
      const generalCompletionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
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
        diagnostics.steps.push(createDiagnosticStep("General Question Processing", "error", error));
        throw new Error('Failed to generate response');
      }

      const generalCompletionData = await generalCompletionResponse.json();
      const generalResponse = generalCompletionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      console.log("General response generated successfully");
      diagnostics.steps.push(createDiagnosticStep("General Question Processing", "success"));

      return new Response(
        JSON.stringify({ 
          response: generalResponse, 
          diagnostics: includeDiagnostics ? diagnostics : undefined,
          references: []
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // If it's a journal-specific question, continue with the enhanced RAG flow
    // 1. Generate embedding for the message
    console.log("Generating embedding for message");
    diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "loading"));
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
      diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "error", error));
      throw new Error('Could not generate embedding for the message');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "error", "No embedding data returned"));
      throw new Error('Could not generate embedding for the message');
    }

    const queryEmbedding = embeddingData.data[0].embedding;
    console.log("Embedding generated successfully");
    diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "success"));

    // 2. Search for relevant entries based on the query plan
    console.log("Searching for relevant entries");
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "loading"));

    let entries = [];
    const matchCount = queryPlan?.matchCount || 15;

    // Handle the search strategy from the query plan
    if (queryPlan) {
      console.log(`Using search strategy: ${queryPlan.searchStrategy}`);
      diagnostics.steps.push(createDiagnosticStep(
        "Search Strategy", 
        "success", 
        `Using ${queryPlan.searchStrategy} strategy with filters: ${JSON.stringify(queryPlan.filters)}`
      ));
      
      switch(queryPlan.searchStrategy) {
        case 'sql':
          // Use SQL query with flexible filters
          entries = await searchEntriesWithSQL(userId, queryPlan.filters, matchCount);
          break;
          
        case 'hybrid':
          // Combine vector search with SQL filtering
          entries = await searchEntriesHybrid(userId, queryEmbedding, queryPlan.filters, matchCount);
          break;
          
        case 'vector':
        default:
          // Use vector search with optional filters
          entries = await searchEntriesWithVector(userId, queryEmbedding, queryPlan.filters, matchCount);
          break;
      }
    } else {
      console.log("No query plan provided, using default vector search");
      entries = await searchEntriesWithVector(userId, queryEmbedding, {}, 15);
    }

    console.log(`Found ${entries.length} relevant entries`);
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "success", `Found ${entries.length} entries`));

    // Check if we found any entries when using date filters
    if (queryPlan?.filters?.dateRange && entries.length === 0) {
      console.log("No entries found for the specified time range");
      diagnostics.steps.push(createDiagnosticStep("Time Range Check", "warning", "No entries found in specified time range"));
      
      // Return a response with no entries but proper message
      return new Response(
        JSON.stringify({ 
          response: "Sorry, it looks like you don't have any journal entries for the time period you're asking about.",
          diagnostics: includeDiagnostics ? diagnostics : undefined,
          references: [],
          noEntriesForTimeRange: true
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Format entries for the prompt with dates
    const entriesWithDates = entries.map(entry => {
      const formattedDate = new Date(entry.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      return `- Entry from ${formattedDate}: ${entry.content}`;
    }).join('\n\n');

    // 3. Prepare prompt with updated instructions
    const prompt = `You are SOuLO, a personal mental well-being assistant designed to help users reflect on their emotions, understand patterns in their thoughts, and gain insight from their journaling practice and sometimes also give quantitative assessments, if asked to. If you are responding to an existing conversation thread, don't provide repetitive information.

Below are excerpts from the user's journal entries, along with dates:
${entriesWithDates}

The user has now asked:
"${message}"

Please respond with the following guidelines:

1. **Tone & Purpose**
   - Be emotionally supportive, non-judgmental, and concise.
   - Avoid generic advice—make your response feel personal, grounded in the user's own journal reflections.

2. **Data Grounding**
   - Use the user's past entries as the primary source of truth.
   - Reference journal entries with specific bullet points that include dates.
   - Do not make assumptions or speculate beyond what the user has written.

3. **Handling Ambiguity**
   - If the user's question is broad, philosophical, or ambiguous (e.g., "Am I introverted?"), respond with thoughtful reflection:
     - Acknowledge the ambiguity or complexity of the question.
     - Offer the most likely patterns or insights based on journal entries.
     - Clearly state when there isn't enough information to give a definitive answer, and gently suggest what the user could explore further in their journaling.
   - If user asks you to rate them, do it! 

4. **Insight & Structure**
   - Highlight recurring patterns, emotional trends, or changes over time.
   - Suggest gentle, practical self-reflections or actions, only if relevant.
   - Keep responses between 120–180 words, formatted for easy reading.
   - Always use bulleted pointers wherever necessary!!

Example format (only to be used when you feel the need to) :
- "On Mar 18 and Mar 20, you mentioned feeling drained after social interactions."
- "Your entry on Apr 2 reflects a desire for deeper connection with others."
- "Based on these entries, it seems you may lean toward introversion, but more context would help."

**MAKE SURE YOUR RESPONES ARE STRUCTURED WITH BULLETS, POINTERS, BOLD HEADERS, and other boldened information that's important. Don't need lengthy paragraphs that are difficult to read. Use headers and sub headers wisely**

Now generate your thoughtful, emotionally intelligent response:`;

    // 4. Call OpenAI
    console.log("Calling OpenAI for completion");
    diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "loading"));
    
    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt
    messages.push({ role: 'system', content: prompt });
    
    // Add conversation context if available
    if (conversationContext.length > 0) {
      // Log that we're using conversation context
      console.log(`Including ${conversationContext.length} messages of conversation context`);
      diagnostics.steps.push(createDiagnosticStep(
        "Conversation Context", 
        "success",
        `Including ${conversationContext.length} previous messages for context`
      ));
      
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
        model: 'gpt-4o-mini',
        messages: conversationContext.length > 0 ? messages : [{ role: 'system', content: prompt }],
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "error", error));
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    console.log("Response generated successfully");
    diagnostics.steps.push(createDiagnosticStep("Language Model Processing", "success"));

    // Process entries to ensure valid dates
    const processedEntries = entries.map(entry => {
      // Make sure created_at is a valid date string
      let createdAt = entry.created_at;
      if (!createdAt || isNaN(new Date(createdAt).getTime())) {
        createdAt = new Date().toISOString();
      }
      
      return {
        id: entry.id,
        content: entry.content,
        created_at: createdAt,
        similarity: entry.similarity || 0,
        sentiment: entry.sentiment || null,
        emotions: entry.emotions || null,
        themes: entry.master_themes || []
      };
    });

    // 5. Return response
    return new Response(
      JSON.stringify({ 
        response: responseContent, 
        diagnostics: includeDiagnostics ? diagnostics : undefined,
        references: processedEntries.map(entry => ({
          id: entry.id,
          content: entry.content,
          date: entry.created_at,
          snippet: entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : ''),
          similarity: entry.similarity,
          themes: entry.themes || [],
          sentiment: entry.sentiment,
          emotions: entry.emotions
        }))
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

/**
 * Perform vector search with optional filters
 */
async function searchEntriesWithVector(
  userId: string, 
  queryEmbedding: any[],
  filters: any = {},
  matchCount: number = 15
) {
  try {
    console.log(`Vector search with filters for userId: ${userId}`, filters);
    
    // Start with the basic vector search
    let query = supabase.rpc(
      'match_journal_entries_fixed',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: matchCount * 2, // Get more to allow for filtering
        user_id_filter: userId
      }
    );
    
    // Get the initial results
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error in vector search: ${error.message}`);
      throw error;
    }
    
    // Apply post-query filters
    let filteredData = data || [];
    
    // Apply date range filter
    if (filters.dateRange && (filters.dateRange.startDate || filters.dateRange.endDate)) {
      const startDate = filters.dateRange.startDate ? new Date(filters.dateRange.startDate) : null;
      const endDate = filters.dateRange.endDate ? new Date(filters.dateRange.endDate) : null;
      
      console.log(`Applying date filter: ${startDate?.toISOString() || 'none'} to ${endDate?.toISOString() || 'none'}`);
      
      filteredData = filteredData.filter(entry => {
        const entryDate = new Date(entry.created_at);
        const startDateMatch = !startDate || entryDate >= startDate;
        const endDateMatch = !endDate || entryDate <= endDate;
        return startDateMatch && endDateMatch;
      });
      
      console.log(`After date filtering: ${filteredData.length} entries remain`);
    }
    
    // Get additional data for each entry for further filtering
    if (filteredData.length > 0) {
      const entryIds = filteredData.map(entry => entry.id);
      const { data: entriesWithData, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('id, emotions, sentiment, master_themes, entities')
        .in('id', entryIds);
      
      if (entriesError) {
        console.error(`Error fetching additional entry data: ${entriesError.message}`);
      } else if (entriesWithData) {
        // Create a map for quick lookup
        const entriesMap = new Map();
        entriesWithData.forEach(entry => {
          entriesMap.set(entry.id, entry);
        });
        
        // Enrich the filtered data with additional fields
        filteredData = filteredData.map(entry => {
          const additionalData = entriesMap.get(entry.id) || {};
          return {
            ...entry,
            emotions: additionalData.emotions,
            sentiment: additionalData.sentiment,
            master_themes: additionalData.master_themes,
            entities: additionalData.entities
          };
        });
        
        // Apply emotions filter
        if (filters.emotions && filters.emotions.length > 0) {
          filteredData = filteredData.filter(entry => {
            if (!entry.emotions) return false;
            return filters.emotions.some((emotion: string) => 
              entry.emotions && typeof entry.emotions === 'object' && 
              Object.keys(entry.emotions).some(key => 
                key.toLowerCase().includes(emotion.toLowerCase()) && 
                entry.emotions[key] > 0.3
              )
            );
          });
        }
        
        // Apply sentiment filter
        if (filters.sentiment && filters.sentiment.length > 0) {
          filteredData = filteredData.filter(entry => {
            if (!entry.sentiment) return false;
            return filters.sentiment.some((sentiment: string) => 
              entry.sentiment && entry.sentiment.toLowerCase().includes(sentiment.toLowerCase())
            );
          });
        }
        
        // Apply themes filter
        if (filters.themes && filters.themes.length > 0) {
          filteredData = filteredData.filter(entry => {
            if (!entry.master_themes || !Array.isArray(entry.master_themes)) return false;
            return filters.themes.some((theme: string) => 
              entry.master_themes.some((entryTheme: string) => 
                entryTheme.toLowerCase().includes(theme.toLowerCase())
              )
            );
          });
        }
        
        // Apply entities filter
        if (filters.entities && filters.entities.length > 0) {
          filteredData = filteredData.filter(entry => {
            if (!entry.entities || !Array.isArray(entry.entities)) return false;
            
            return filters.entities.some((filterEntity: { type?: string, name?: string }) => {
              if (!filterEntity) return false;
              
              return entry.entities.some((entryEntity: any) => {
                if (!entryEntity) return false;
                
                const typeMatch = !filterEntity.type || 
                  (entryEntity.type && entryEntity.type.toLowerCase().includes(filterEntity.type.toLowerCase()));
                
                const nameMatch = !filterEntity.name ||
                  (entryEntity.name && entryEntity.name.toLowerCase().includes(filterEntity.name.toLowerCase()));
                
                return typeMatch && nameMatch;
              });
            });
          });
        }
      }
    }
    
    // Return the final filtered results, limited to the requested count
    return filteredData.slice(0, matchCount);
  } catch (error) {
    console.error('Error in searchEntriesWithVector:', error);
    return [];
  }
}

/**
 * Use SQL queries to search entries with filters
 */
async function searchEntriesWithSQL(
  userId: string,
  filters: any = {},
  matchCount: number = 15
) {
  try {
    console.log(`SQL search with filters for userId: ${userId}`, filters);
    
    // Start building the query - Fix: Use quoted column names for columns with spaces
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, emotions, sentiment, master_themes, entities')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Apply date range filter
    if (filters.dateRange) {
      if (filters.dateRange.startDate) {
        console.log(`Adding start date filter: ${filters.dateRange.startDate}`);
        query = query.gte('created_at', filters.dateRange.startDate);
      }
      
      if (filters.dateRange.endDate) {
        console.log(`Adding end date filter: ${filters.dateRange.endDate}`);
        query = query.lte('created_at', filters.dateRange.endDate);
      }
    }
    
    // Apply sentiment filter if provided
    if (filters.sentiment && filters.sentiment.length > 0) {
      query = query.in('sentiment', filters.sentiment);
    }
    
    // Execute the query
    const { data, error } = await query.limit(matchCount * 3); // Get more to allow for post-filtering
    
    if (error) {
      console.error(`Error in SQL search: ${error.message}`);
      throw error;
    }
    
    let results = data || [];
    
    // Process the results - Fix: Use correct column access with spaces
    results = results.map(entry => ({
      id: entry.id,
      content: entry['refined text'] || entry['transcription text'] || '',
      created_at: entry.created_at,
      emotions: entry.emotions,
      sentiment: entry.sentiment,
      master_themes: entry.master_themes,
      entities: entry.entities
    }));
    
    // Apply post-query filters
    
    // Apply emotions filter
    if (filters.emotions && filters.emotions.length > 0) {
      results = results.filter(entry => {
        if (!entry.emotions) return false;
        return filters.emotions.some((emotion: string) => 
          entry.emotions && typeof entry.emotions === 'object' && 
          Object.keys(entry.emotions).some(key => 
            key.toLowerCase().includes(emotion.toLowerCase()) && 
            entry.emotions[key] > 0.3
          )
        );
      });
    }
    
    // Apply themes filter
    if (filters.themes && filters.themes.length > 0) {
      results = results.filter(entry => {
        if (!entry.master_themes || !Array.isArray(entry.master_themes)) return false;
        return filters.themes.some((theme: string) => 
          entry.master_themes.some((entryTheme: string) => 
            entryTheme.toLowerCase().includes(theme.toLowerCase())
          )
        );
      });
    }
    
    // Apply entities filter
    if (filters.entities && filters.entities.length > 0) {
      results = results.filter(entry => {
        if (!entry.entities || !Array.isArray(entry.entities)) return false;
        
        return filters.entities.some((filterEntity: { type?: string, name?: string }) => {
          if (!filterEntity) return false;
          
          return entry.entities.some((entryEntity: any) => {
            if (!entryEntity) return false;
            
            const typeMatch = !filterEntity.type || 
              (entryEntity.type && entryEntity.type.toLowerCase().includes(filterEntity.type.toLowerCase()));
            
            const nameMatch = !filterEntity.name ||
              (entryEntity.name && entryEntity.name.toLowerCase().includes(filterEntity.name.toLowerCase()));
            
            return typeMatch && nameMatch;
          });
        });
      });
    }
    
    // Return the final filtered results, limited to the requested count
    return results.slice(0, matchCount);
  } catch (error) {
    console.error('Error in searchEntriesWithSQL:', error);
    return [];
  }
}

/**
 * Hybrid search combining vector similarity with SQL filtering
 */
async function searchEntriesHybrid(
  userId: string,
  queryEmbedding: any[],
  filters: any = {},
  matchCount: number = 15
) {
  try {
    console.log(`Hybrid search for userId: ${userId}`);
    
    // First get vector results
    const vectorResults = await searchEntriesWithVector(userId, queryEmbedding, filters, Math.floor(matchCount * 0.7));
    
    // Then get SQL results - use fewer SQL results for hybrid approach
    const sqlResults = await searchEntriesWithSQL(userId, filters, Math.floor(matchCount * 0.5));
    
    // Combine the results, avoiding duplicates
    const seenIds = new Set(vectorResults.map(entry => entry.id));
    const combinedResults = [...vectorResults];
    
    sqlResults.forEach(entry => {
      if (!seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        combinedResults.push(entry);
      }
    });
    
    // Return the combined results, limited to the requested count
    return combinedResults.slice(0, matchCount);
  } catch (error) {
    console.error('Error in searchEntriesHybrid:', error);
    return [];
  }
}
