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
    const { message, userId, threadId, researchPlan, researchStep, includeDiagnostics } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    
    // Initialize diagnostics
    const diagnostics = {
      steps: [],
      similarityScores: [],
      functionCalls: [],
      references: []
    };
    
    diagnostics.steps.push(createDiagnosticStep("Request Received", "success", { message: message.substring(0, 50) + "..." }));
    
    // If researchPlan is provided, this is a request to execute a specific research step
    if (researchPlan && researchStep) {
      diagnostics.steps.push(createDiagnosticStep("Research Step Execution", "loading", { step: researchStep }));
      
      try {
        const stepData = JSON.parse(researchStep);
        
        if (stepData.type === "vector_search") {
          // Extract parameters
          const { timeRange, matchThreshold = 0.5, matchCount = 10, emotion, theme, query } = stepData.parameters || {};
          
          // Generate embedding for the query if needed
          let queryEmbedding;
          if (query) {
            const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'text-embedding-ada-002',
                input: query,
              }),
            });
            
            if (!embeddingResponse.ok) {
              const error = await embeddingResponse.text();
              diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "error", error));
              throw new Error(`Failed to generate embedding: ${error}`);
            }
            
            const embeddingData = await embeddingResponse.json();
            queryEmbedding = embeddingData.data[0].embedding;
            diagnostics.steps.push(createDiagnosticStep("Embedding Generation", "success"));
          }
          
          // Execute the vector search based on parameters
          let entries = [];
          
          if (emotion) {
            diagnostics.steps.push(createDiagnosticStep("Emotion-Based Search", "loading", { emotion }));
            const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
              emotion_name: emotion,
              user_id_filter: userId,
              min_score: 0.3,
              start_date: timeRange?.startDate || null,
              end_date: timeRange?.endDate || null,
              limit_count: matchCount
            });
            
            if (error) {
              diagnostics.steps.push(createDiagnosticStep("Emotion-Based Search", "error", error.message));
              throw error;
            }
            
            entries = data;
            diagnostics.steps.push(createDiagnosticStep("Emotion-Based Search", "success", { count: entries.length }));
          } else if (theme) {
            diagnostics.steps.push(createDiagnosticStep("Theme-Based Search", "loading", { theme }));
            const { data, error } = await supabase.rpc('match_journal_entries_by_theme', {
              theme_query: theme,
              user_id_filter: userId,
              match_threshold: matchThreshold,
              match_count: matchCount,
              start_date: timeRange?.startDate || null,
              end_date: timeRange?.endDate || null
            });
            
            if (error) {
              diagnostics.steps.push(createDiagnosticStep("Theme-Based Search", "error", error.message));
              throw error;
            }
            
            entries = data;
            diagnostics.steps.push(createDiagnosticStep("Theme-Based Search", "success", { count: entries.length }));
          } else if (timeRange?.startDate || timeRange?.endDate) {
            diagnostics.steps.push(createDiagnosticStep("Time-Filtered Search", "loading", { timeRange }));
            const { data, error } = await supabase.rpc('match_journal_entries_with_date', {
              query_embedding: queryEmbedding,
              match_threshold: matchThreshold,
              match_count: matchCount,
              user_id_filter: userId,
              start_date: timeRange?.startDate || null,
              end_date: timeRange?.endDate || null
            });
            
            if (error) {
              diagnostics.steps.push(createDiagnosticStep("Time-Filtered Search", "error", error.message));
              throw error;
            }
            
            entries = data;
            diagnostics.steps.push(createDiagnosticStep("Time-Filtered Search", "success", { count: entries.length }));
          } else {
            diagnostics.steps.push(createDiagnosticStep("Standard Vector Search", "loading"));
            const { data, error } = await supabase.rpc('match_journal_entries_fixed', {
              query_embedding: queryEmbedding,
              match_threshold: matchThreshold,
              match_count: matchCount,
              user_id_filter: userId
            });
            
            if (error) {
              diagnostics.steps.push(createDiagnosticStep("Standard Vector Search", "error", error.message));
              throw error;
            }
            
            entries = data;
            diagnostics.steps.push(createDiagnosticStep("Standard Vector Search", "success", { count: entries.length }));
          }
          
          return new Response(
            JSON.stringify({
              type: "vector_search_results",
              description: stepData.description,
              entries,
              diagnostics: includeDiagnostics ? diagnostics : undefined
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        } else if (stepData.type === "sql_query") {
          diagnostics.steps.push(createDiagnosticStep("SQL Query Execution", "loading"));
          const { query, parameters = [] } = stepData.parameters || {};
          
          if (!query) {
            diagnostics.steps.push(createDiagnosticStep("SQL Query Execution", "error", "No query provided"));
            throw new Error("SQL query not specified in step parameters");
          }
          
          const { data, error } = await supabase.rpc('execute_dynamic_query', {
            query_text: query,
            param_values: parameters
          });
          
          if (error) {
            diagnostics.steps.push(createDiagnosticStep("SQL Query Execution", "error", error.message));
            throw error;
          }
          
          diagnostics.steps.push(createDiagnosticStep("SQL Query Execution", "success"));
          
          return new Response(
            JSON.stringify({
              type: "sql_query_results",
              description: stepData.description,
              data,
              diagnostics: includeDiagnostics ? diagnostics : undefined
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        } else {
          throw new Error(`Unknown research step type: ${stepData.type}`);
        }
      } catch (error) {
        console.error("Error executing research step:", error);
        return new Response(
          JSON.stringify({ 
            error: error.message,
            diagnostics: includeDiagnostics ? diagnostics : undefined
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }
    }

    // NEW: First categorize if this is a general question or a journal-specific question
    diagnostics.steps.push(createDiagnosticStep("Question Categorization", "loading"));
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
    
    // For journal-specific questions, continue with our existing RAG implementation
    // But add a step to generate a research plan first
    diagnostics.steps.push(createDiagnosticStep("Research Planning", "loading"));
    
    console.log("Generating research plan");
    const researchPlanResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a research planner for a voice journaling app. A user has asked a question related to their journal entries. Your job is to create a comprehensive research plan to answer their question.

Based on the user's question, create a research plan with specific steps to retrieve and analyze the relevant data.
Your research plan should specify:
   - What database functions or SQL queries to use
   - What parameters to include (time ranges, emotions, themes, etc.)
   - How to process and synthesize the information

Database functions available:
- match_journal_entries_fixed: Vector similarity search on journal entries
- match_journal_entries_with_date: Vector similarity search with date filtering
- match_journal_entries_by_emotion: Find entries with specific emotions
- match_journal_entries_by_theme: Find entries with specific themes
- get_top_emotions: Get most frequent emotions in a time period
- get_top_emotions_with_entries: Get top emotions with sample journal entries
- execute_dynamic_query: Execute custom SQL queries

The user asked: "${message}"

Output your research plan in JSON format following this structure:
{
  "strategy": "vector_search" or "sql_query" or "hybrid",
  "steps": [
    {
      "type": "vector_search",
      "description": "Description of what this step retrieves",
      "parameters": {
        // Parameters specific to this query type
        "query": "search query",
        "timeRange": {"startDate": "ISO date", "endDate": "ISO date"},
        "matchThreshold": 0.5,
        "matchCount": 10
      }
    }
  ]
}`
          }
        ],
        temperature: 0.2
      }),
    });
    
    if (!researchPlanResponse.ok) {
      const error = await researchPlanResponse.text();
      console.error('Failed to generate research plan:', error);
      diagnostics.steps.push(createDiagnosticStep("Research Planning", "error", error));
      
      // Fall back to standard vector search
      diagnostics.steps.push(createDiagnosticStep("Fallback Vector Search", "loading"));
    } else {
      const researchPlanData = await researchPlanResponse.json();
      const researchPlanText = researchPlanData.choices[0]?.message?.content || '';
      
      try {
        const researchPlan = JSON.parse(researchPlanText);
        diagnostics.steps.push(createDiagnosticStep(
          "Research Planning", 
          "success", 
          `Generated plan with ${researchPlan.steps?.length || 0} steps`
        ));
        
        // TODO: Implement the execution of the research plan
        // This would involve executing each step and collecting the results
        // We'll leave this for a future implementation
      } catch (parseError) {
        console.error('Failed to parse research plan:', parseError);
        diagnostics.steps.push(createDiagnosticStep(
          "Research Planning", 
          "error", 
          `Failed to parse plan: ${parseError.message}`
        ));
      }
    }
    
    // For now, we'll continue with our existing implementation
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

    // 2. Search for relevant entries with time filtering if available
    console.log("Searching for relevant entries");
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "loading"));
    
    // Extract time range from the query analysis if available
    let entries = [];
    entries = await searchEntriesWithVector(userId, queryEmbedding);
    
    console.log(`Found ${entries.length} relevant entries`);
    diagnostics.steps.push(createDiagnosticStep("Knowledge Base Search", "success", `Found ${entries.length} entries`));

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
    let conversationContext = [];
    if (threadId) {
      try {
        const { data: previousMessages, error } = await supabase
          .from('chat_messages')
          .select('content, sender, created_at')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(MAX_CONTEXT_MESSAGES * 2);
        
        if (!error && previousMessages && previousMessages.length > 0) {
          conversationContext = [...previousMessages].reverse().map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
          
          if (conversationContext.length > MAX_CONTEXT_MESSAGES) {
            conversationContext = conversationContext.slice(-MAX_CONTEXT_MESSAGES);
          }
          
          messages.push(...conversationContext);
          messages.push({ role: 'user', content: message });
          
          diagnostics.steps.push(createDiagnosticStep(
            "Conversation Context", 
            "success",
            `Including ${conversationContext.length} previous messages for context`
          ));
        }
      } catch (contextError) {
        console.error('Error processing thread context:', contextError);
      }
    }
    
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: conversationContext.length > 0 ? messages : [
          { role: 'system', content: prompt },
          { role: 'user', content: message }
        ],
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
        similarity: entry.similarity || 0
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
          similarity: entry.similarity
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
    
    console.log(`Found ${data?.length || 0} entries with vector similarity`);
    return data || [];
  } catch (error) {
    console.error('Error searching entries with vector:', error);
    throw error;
  }
}

// Time-filtered vector search (keeping for compatibility)
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
