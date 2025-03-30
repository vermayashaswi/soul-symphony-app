
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

// Define known emotion categories for better querying
const EMOTION_CATEGORIES = {
  positive: ['happiness', 'joy', 'excitement', 'love', 'gratitude', 'contentment', 'pride', 'amusement', 'optimism'],
  negative: ['sadness', 'anger', 'fear', 'anxiety', 'disgust', 'shame', 'guilt', 'regret', 'disappointment'],
  neutral: ['surprise', 'curiosity', 'confusion', 'contemplation', 'nostalgia']
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

// New function to analyze the query and extract relevant parts
async function analyzeQuery(query: string) {
  try {
    console.log("Analyzing query:", query);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `
            You are a query analyzer for a journaling app. Extract structured information from user queries about their journal entries.
            
            Identify:
            1. The query type (emotion, theme, entity, general, etc.)
            2. Any specific emotions mentioned (directly or indirectly)
            3. Any themes mentioned
            4. Any entity types and names (e.g., workplace, person, location)
            5. Timeframe hints (today, last week, etc.)
            6. Whether this is a "when" question (asking about timing of events)
            
            Return a JSON object with these fields. For emotion field, identify both the explicit emotion term used by the user AND the standard emotion categories it might map to (joy, sadness, anger, fear, surprise, etc.).
            
            For emotion synonyms, provide an array of possible emotion terms that could match database categories.
            `
          },
          { role: 'user', content: query }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error analyzing query:', error);
      throw new Error('Failed to analyze query');
    }

    const result = await response.json();
    const analysis = JSON.parse(result.choices[0].message.content);
    
    console.log("Query analysis:", JSON.stringify(analysis));
    return analysis;
  } catch (error) {
    console.error('Error in analyzeQuery:', error);
    // Return a default analysis to continue execution
    return {
      queryType: "general",
      emotion: null,
      theme: null,
      entityType: null,
      entityName: null,
      timeframe: {
        timeType: null,
        startDate: null,
        endDate: new Date().toISOString()
      },
      isWhenQuestion: false
    };
  }
}

// New function to get emotion mappings from the emotions table
async function getEmotionMappings(emotionTerm: string) {
  if (!emotionTerm) return [];
  
  try {
    console.log("Looking up emotion mappings for:", emotionTerm);
    
    // First attempt to find direct matches
    const { data: directMatches, error: directError } = await supabase
      .from('emotions')
      .select('name, description')
      .ilike('name', `%${emotionTerm}%`);
    
    if (directError) {
      console.error("Error querying emotions table:", directError);
      return [];
    }
    
    if (directMatches && directMatches.length > 0) {
      console.log(`Found ${directMatches.length} direct emotion matches`);
      return directMatches.map(match => match.name.toLowerCase());
    }
    
    // If no direct matches, use GPT to find relevant emotions
    console.log("No direct matches found, using GPT to find related emotions");
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an emotion classification specialist. Given a term that might express an emotional state, map it to the most closely related standard emotions from this list: 
            joy, happiness, excitement, love, gratitude, contentment, pride, amusement, optimism, sadness, anger, fear, anxiety, disgust, shame, guilt, regret, disappointment, surprise, curiosity, confusion, contemplation, nostalgia.
            
            Return a JSON array with the top 3 most relevant standard emotions.`
          },
          { role: 'user', content: emotionTerm }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error mapping emotions with GPT:', error);
      return [];
    }

    const result = await response.json();
    const mappedEmotions = JSON.parse(result.choices[0].message.content);
    console.log("GPT mapped emotions:", mappedEmotions);
    
    return Array.isArray(mappedEmotions) ? mappedEmotions.map(e => e.toLowerCase()) : [];
    
  } catch (error) {
    console.error('Error in getEmotionMappings:', error);
    return [];
  }
}

// Search for journal entries based on an emotion
async function searchEntriesByEmotion(
  userId: string, 
  emotionTerm: string,
  timeframe: any
) {
  try {
    if (!emotionTerm) return [];
    
    console.log(`Searching for entries with emotion: ${emotionTerm}`);
    
    // Get emotion mappings from the emotions table
    const mappedEmotions = await getEmotionMappings(emotionTerm);
    console.log("Mapped emotions:", mappedEmotions);
    
    if (mappedEmotions.length === 0) {
      console.log("No emotion mappings found, using original term");
      mappedEmotions.push(emotionTerm.toLowerCase());
    }
    
    let allResults = [];
    const minScore = 0.3; // Minimum score threshold for emotions
    
    // Search for each mapped emotion
    for (const emotion of mappedEmotions) {
      console.log(`Querying for emotion: ${emotion}`);
      
      const { data, error } = await supabase.rpc(
        'match_journal_entries_by_emotion',
        {
          emotion_name: emotion,
          user_id_filter: userId,
          min_score: minScore,
          start_date: timeframe?.startDate || null,
          end_date: timeframe?.endDate || null,
          limit_count: 10
        }
      );
      
      if (error) {
        console.error(`Error in emotion search for ${emotion}:`, error);
        continue;
      }
      
      if (data && data.length > 0) {
        console.log(`Found ${data.length} entries for emotion: ${emotion}`);
        allResults = [...allResults, ...data];
      }
    }
    
    // If we still don't have results, try a more generic search
    if (allResults.length === 0) {
      console.log("No entries found with specific emotions, trying text search");
      
      const { data, error } = await supabase.rpc(
        'get_entries_by_emotion_term',
        {
          emotion_term: emotionTerm,
          user_id_filter: userId,
          start_date: timeframe?.startDate || null,
          end_date: timeframe?.endDate || null
        }
      );
      
      if (error) {
        console.error("Error in text-based emotion search:", error);
      } else if (data && data.length > 0) {
        console.log(`Found ${data.length} entries through text search`);
        allResults = [...allResults, ...data];
      }
    }
    
    // Remove duplicates by ID
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );
    
    console.log(`Returning ${uniqueResults.length} unique emotion-related entries`);
    return uniqueResults;
    
  } catch (error) {
    console.error("Error in searchEntriesByEmotion:", error);
    return [];
  }
}

// Search for journal entries based on an entity
async function searchEntriesByEntity(
  userId: string, 
  entityType: string,
  entityName: string | null = null,
  timeframe: any
) {
  try {
    if (!entityType) return [];
    
    console.log(`Searching for entries with entity type: ${entityType}, name: ${entityName || 'any'}`);
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at, entities')
      .eq('user_id', userId)
      .not('entities', 'is', null)
      .gte('created_at', timeframe?.startDate || '1970-01-01')
      .lte('created_at', timeframe?.endDate || new Date().toISOString());
    
    if (error) {
      console.error("Error in entity search:", error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log("No entries with entities found");
      return [];
    }
    
    // Filter entries containing the specified entity type and optional name
    const filteredEntries = data.filter(entry => {
      // Skip entries without entities
      if (!entry.entities || !Array.isArray(entry.entities)) return false;
      
      // Check if any entity matches the criteria
      return entry.entities.some(entity => {
        const matchesType = entity.type && entity.type.toLowerCase() === entityType.toLowerCase();
        const matchesName = !entityName || 
                           (entity.name && 
                            entity.name.toLowerCase().includes(entityName.toLowerCase()));
        return matchesType && matchesName;
      });
    });
    
    console.log(`Found ${filteredEntries.length} entries with matching entities`);
    return filteredEntries;
    
  } catch (error) {
    console.error("Error in searchEntriesByEntity:", error);
    return [];
  }
}

// Search for journal entries based on both entity and emotion
async function searchEntriesByEntityAndEmotion(
  userId: string,
  entityType: string,
  emotionTerm: string,
  entityName: string | null = null,
  timeframe: any
) {
  try {
    console.log(`Searching for entries with entity type: ${entityType} and emotion: ${emotionTerm}`);
    
    // Get entries matching the entity criteria
    const entityEntries = await searchEntriesByEntity(
      userId, 
      entityType, 
      entityName, 
      timeframe
    );
    
    if (entityEntries.length === 0) {
      console.log("No entity entries found, cannot combine with emotions");
      return [];
    }
    
    // Get emotion mappings
    const mappedEmotions = await getEmotionMappings(emotionTerm);
    console.log("Mapped emotions for combined search:", mappedEmotions);
    
    if (mappedEmotions.length === 0) {
      console.log("No emotion mappings found, using original term");
      mappedEmotions.push(emotionTerm.toLowerCase());
    }
    
    // Get the IDs of entity entries to filter emotion results
    const entityEntryIds = entityEntries.map(entry => entry.id);
    
    let allResults = [];
    const minScore = 0.3;
    
    // Search for each mapped emotion
    for (const emotion of mappedEmotions) {
      console.log(`Querying for emotion: ${emotion} within entity results`);
      
      const { data, error } = await supabase.rpc(
        'match_journal_entries_by_emotion',
        {
          emotion_name: emotion,
          user_id_filter: userId,
          min_score: minScore,
          start_date: timeframe?.startDate || null,
          end_date: timeframe?.endDate || null,
          limit_count: 50  // Get more results to filter down
        }
      );
      
      if (error) {
        console.error(`Error in emotion search for ${emotion}:`, error);
        continue;
      }
      
      if (data && data.length > 0) {
        // Filter to only include entries that are also in entityEntryIds
        const filteredResults = data.filter(entry => 
          entityEntryIds.includes(entry.id)
        );
        
        console.log(`Found ${filteredResults.length} entries for emotion: ${emotion} after entity filtering`);
        allResults = [...allResults, ...filteredResults];
      }
    }
    
    // Remove duplicates by ID
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );
    
    console.log(`Returning ${uniqueResults.length} unique entries matching both entity and emotion criteria`);
    return uniqueResults;
    
  } catch (error) {
    console.error("Error in searchEntriesByEntityAndEmotion:", error);
    return [];
  }
}

// Enhanced function to search for relevant context based on query analysis
async function searchRelevantContext(userId: string, queryText: string, queryAnalysis: any) {
  try {
    console.log("Searching for relevant context based on query analysis");
    
    let relevantEntries = [];
    
    // Case 1: Entity + Emotion combination (most specific)
    if (queryAnalysis.entityType && queryAnalysis.emotion) {
      console.log("Using entity + emotion combined search");
      relevantEntries = await searchEntriesByEntityAndEmotion(
        userId,
        queryAnalysis.entityType,
        queryAnalysis.emotion,
        queryAnalysis.entityName,
        queryAnalysis.timeframe
      );
    }
    // Case 2: Entity-specific search
    else if (queryAnalysis.entityType) {
      console.log("Using entity-based search");
      relevantEntries = await searchEntriesByEntity(
        userId,
        queryAnalysis.entityType,
        queryAnalysis.entityName,
        queryAnalysis.timeframe
      );
    } 
    // Case 3: Emotion-specific search
    else if (queryAnalysis.emotion) {
      console.log("Using emotion-based search");
      relevantEntries = await searchEntriesByEmotion(
        userId,
        queryAnalysis.emotion,
        queryAnalysis.timeframe
      );
    }
    
    // If targeted searches yielded results, use them
    if (relevantEntries.length > 0) {
      console.log(`Found ${relevantEntries.length} entries through targeted search`);
      return relevantEntries;
    }
    
    // Case 4: Fallback to vector similarity search
    console.log("Using embedding for search");
    const queryEmbedding = await generateEmbedding(queryText);
    
    const { data: vectorResults, error: vectorError } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        user_id_filter: userId,
        start_date: queryAnalysis.timeframe?.startDate || null,
        end_date: queryAnalysis.timeframe?.endDate || null
      }
    );
    
    if (vectorError) {
      console.error("Error in vector similarity search:", vectorError);
      return [];
    }
    
    if (vectorResults && vectorResults.length > 0) {
      console.log(`Vector similarity search found ${vectorResults.length} entries`);
      return vectorResults;
    }
    
    // Case 5: Last resort - fetch recent entries
    console.log("No similar entries found, falling back to recent entries");
    const { data: recentEntries, error: recentError } = await supabase
      .from('Journal Entries')
      .select('id, "refined text", created_at, emotions')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (recentError) {
      console.error("Error retrieving recent entries:", recentError);
      return [];
    }
    
    if (recentEntries && recentEntries.length > 0) {
      console.log(`Retrieved ${recentEntries.length} recent entries as fallback`);
      return recentEntries;
    }
    
    return [];
    
  } catch (error) {
    console.error("Error in searchRelevantContext:", error);
    return [];
  }
}

// Function to fetch messages from a thread for conversation context
async function fetchPreviousMessages(threadId: string, limit = 10) {
  if (!threadId || threadId === 'new thread') {
    console.log("No thread ID provided");
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error("Error fetching previous messages:", error);
      return [];
    }
    
    console.log(`Retrieved ${data?.length || 0} previous messages`);
    return data || [];
    
  } catch (error) {
    console.error("Error in fetchPreviousMessages:", error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId = null, includeDiagnostics = false } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Thread ID:", threadId || "new thread");
    console.log("Include diagnostics:", includeDiagnostics ? "yes" : "no");
    
    // Analyze the query to understand what the user is asking about
    const queryAnalysis = await analyzeQuery(message);
    
    // Search for relevant journal entries based on query analysis
    const relevantEntries = await searchRelevantContext(userId, message, queryAnalysis);
    console.log(`Found ${relevantEntries.length} relevant entries`);
    
    // Fetch previous conversation messages for context if a thread ID is provided
    const previousMessages = await fetchPreviousMessages(threadId);
    console.log(`Fetching previous messages for conversation context...`);
    
    // Create a new thread if none was provided
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const { data: newThread, error: threadError } = await supabase
        .from('chat_threads')
        .insert([{ 
          user_id: userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        }])
        .select('id')
        .single();
        
      if (threadError) {
        console.error("Error creating new thread:", threadError);
      } else {
        currentThreadId = newThread.id;
        console.log(`Created new thread with ID: ${currentThreadId}`);
      }
    }
    
    // Create RAG context from relevant entries
    let journalContext = "";
    if (relevantEntries.length > 0) {
      console.log(`Found ${relevantEntries.length} relevant entries`);
      
      journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
        relevantEntries.map((entry, index) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const emotionsText = entry.emotions ? formatEmotions(entry.emotions) : "No emotion data";
          return `Entry ${index+1} (${date}):\n${entry["refined text"] || entry.content}\nPrimary emotions: ${emotionsText}`;
        }).join('\n\n') + "\n\n";
    } else {
      console.log("No relevant entries found");
      journalContext = "I don't have access to any journal entries that are relevant to your question.";
    }
    
    // Build conversation history context
    let conversationContext = "";
    if (previousMessages.length > 0) {
      console.log("Including previous conversation context");
      conversationContext = "Here's your recent conversation history:\n\n" +
        previousMessages
          .reverse() // Display in chronological order
          .map(msg => `${msg.sender === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
          .join('\n\n') + "\n\n";
    }
    
    // Prepare system prompt with RAG context and conversation history
    const systemPrompt = `You are Feelosophy, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext}

${conversationContext}

Based on the context above and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic.`;

    console.log("Sending to GPT with RAG context and conversation history...");
    
    try {
      // Send to GPT with RAG context
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GPT API error:", errorText);
        throw new Error(`GPT API error: ${errorText}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      console.log("AI response generated successfully");
      
      // Save the messages to the database if we have a thread ID
      if (currentThreadId) {
        // Save user message
        await supabase
          .from('chat_messages')
          .insert([{
            thread_id: currentThreadId,
            sender: 'user',
            content: message
          }]);
          
        // Save assistant response with reference to entries used
        await supabase
          .from('chat_messages')
          .insert([{
            thread_id: currentThreadId,
            sender: 'assistant',
            content: aiResponse,
            reference_entries: relevantEntries.length > 0 
              ? { entries: relevantEntries.map(e => e.id) } 
              : null
          }]);
      }
      
      // Prepare response
      const responseBody: any = { 
        response: aiResponse,
        threadId: currentThreadId,
      };
      
      // Include additional debugging data if requested
      if (includeDiagnostics) {
        responseBody.analysis = queryAnalysis;
        responseBody.entryCount = relevantEntries.length;
        
        if (relevantEntries.length > 0) {
          responseBody.sampleEntries = relevantEntries.slice(0, 2).map(entry => ({
            id: entry.id,
            created_at: entry.created_at,
            excerpt: (entry["refined text"] || entry.content || '').substring(0, 100) + '...',
            emotions: entry.emotions
          }));
        }
      }
      
      return new Response(
        JSON.stringify(responseBody),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (apiError) {
      console.error("API error:", apiError);
      
      // Return a 200 status even for errors to avoid CORS issues
      return new Response(
        JSON.stringify({ 
          error: apiError.message, 
          response: "I'm having trouble connecting right now. Please try again later.",
          success: false 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Error in chat-with-rag function:", error);
    
    // Return 200 status even for errors to avoid CORS issues
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        success: false 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
