
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

// Function to get previous messages from a thread
async function getPreviousMessages(threadId: string, messageLimit: number = 5) {
  if (!threadId) return [];
  
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('content, sender')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(messageLimit);
      
    if (error) {
      console.error("Error fetching previous messages:", error);
      return [];
    }
    
    // Return in chronological order (oldest first)
    return data.reverse().map(msg => ({
      role: msg.sender === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  } catch (error) {
    console.error("Error in getPreviousMessages:", error);
    return [];
  }
}

// Function to search journal entries with date range
async function searchJournalEntriesWithDate(
  userId: string, 
  queryEmbedding: any,
  startDate: string | null = null,
  endDate: string | null = null,
  matchThreshold: number = 0.5,
  matchCount: number = 5
) {
  try {
    console.log(`Calling match_journal_entries_with_date with userId: ${userId}`);
    console.log(`Date range: ${startDate || 'none'} to ${endDate || 'none'}`);
    
    let params: any = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId
    };
    
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const { data, error } = await supabase.rpc('match_journal_entries_with_date', params);
    
    if (error) {
      console.error("Error in date-filtered similarity search:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Exception in searchJournalEntriesWithDate:", error);
    return null;
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
    processingTime: {
      embedding: 0,
      search: 0,
      context: 0,
      llm: 0,
      total: 0
    }
  };
  
  const startTime = Date.now();

  try {
    const { message, userId, threadId, isNewThread, threadTitle, includeDiagnostics, timeframe } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Include diagnostics:", includeDiagnostics ? "yes" : "no");
    console.log("Thread ID:", threadId || "new thread");
    console.log("Timeframe specified:", timeframe || "none");
    
    let similarityScores = [];
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const embeddingStartTime = Date.now();
    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(message);
      diagnostics.embeddingGenerated = true;
      diagnostics.processingTime.embedding = Date.now() - embeddingStartTime;
    } catch (error) {
      console.error("Error generating embedding:", error);
      diagnostics.embeddingError = error.message;
      throw error;
    }
    
    // Determine if we need time-based search
    const needsTimeSearch = timeframe && (
      message.toLowerCase().includes("last week") || 
      message.toLowerCase().includes("last month") || 
      message.toLowerCase().includes("last year") ||
      message.toLowerCase().includes("this week") || 
      message.toLowerCase().includes("this month") ||
      message.toLowerCase().includes("recent") ||
      message.toLowerCase().includes("yesterday") ||
      message.toLowerCase().includes("today")
    );
    
    // Search for relevant journal entries using vector similarity
    console.log("Searching for relevant context...");
    const searchStartTime = Date.now();
    let similarEntries;
    
    if (needsTimeSearch) {
      // Calculate date range based on timeframe
      let startDate = null;
      let endDate = new Date().toISOString();
      
      if (timeframe === 'week') {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        startDate = lastWeek.toISOString();
      } else if (timeframe === 'month') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        startDate = lastMonth.toISOString();
      } else if (timeframe === 'year') {
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        startDate = lastYear.toISOString();
      }
      
      console.log(`Using date range search from ${startDate} to ${endDate}`);
      similarEntries = await searchJournalEntriesWithDate(
        userId, 
        queryEmbedding,
        startDate,
        endDate
      );
    } else {
      try {
        // Ensure the userId is properly cast as a UUID type when calling the function
        console.log(`Calling match_journal_entries with userId: ${userId} (${typeof userId})`);
        const { data, error } = await supabase.rpc(
          'match_journal_entries',
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 5,
            user_id_filter: userId // This is the correct parameter name
          }
        );
        
        if (error) {
          console.error("Error searching for similar entries:", error);
          console.error("Search error details:", JSON.stringify(error));
          diagnostics.searchError = error.message || "Database search error";
          throw error;
        }
        
        similarEntries = data;
      } catch (error) {
        console.error("Error in standard similarity search:", error);
        diagnostics.searchError = error.message || "Error in similarity search";
      }
    }
    
    diagnostics.similaritySearchComplete = true;
    diagnostics.processingTime.search = Date.now() - searchStartTime;
    
    if (similarEntries && similarEntries.length > 0) {
      similarityScores = similarEntries.map(entry => ({
        id: entry.id,
        score: entry.similarity
      }));
      
      // Log the similarity scores to check the results
      console.log("Found similar entries:", similarEntries.length);
      console.log("Similarity scores:", JSON.stringify(similarityScores));
    } else {
      console.log("No similar entries found in vector search");
    }
    
    // Create RAG context from relevant entries
    const contextStartTime = Date.now();
    let journalContext = "";
    let referenceEntries = [];
    
    try {
      if (similarEntries && similarEntries.length > 0) {
        console.log("Found similar entries:", similarEntries.length);
        
        // Fetch full entries for context
        const entryIds = similarEntries.map(entry => entry.id);
        
        // Using column name with space "refined text" instead of "refinedtext"
        const { data: entries, error: entriesError } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", created_at, emotions')
          .in('id', entryIds);
        
        if (entriesError) {
          console.error("Error retrieving journal entries:", entriesError);
          diagnostics.contextError = entriesError.message || "Error retrieving journal entries";
        } else if (entries && entries.length > 0) {
          console.log("Retrieved full entries:", entries.length);
          
          // Store reference information
          referenceEntries = entries.map(entry => {
            // Find the similarity score for this entry
            const similarEntry = similarEntries.find(se => se.id === entry.id);
            return {
              id: entry.id,
              date: entry.created_at,
              snippet: entry["refined text"]?.substring(0, 100) + "...",
              similarity: similarEntry ? similarEntry.similarity : 0
            };
          });
          
          // Format entries as context with emotions data
          journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
            entries.map((entry, index) => {
              const date = new Date(entry.created_at).toLocaleDateString();
              const emotionsText = formatEmotions(entry.emotions);
              return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
            }).join('\n\n') + "\n\n";
            
          diagnostics.contextBuilt = true;
          diagnostics.contextSize = journalContext.length;
        }
      } else {
        console.log("No similar entries found, falling back to recent entries");
        // Fallback to recent entries if no similar ones found
        const { data: recentEntries, error: recentError } = await supabase
          .from('Journal Entries')
          .select('id, "refined text", created_at, emotions')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (recentError) {
          console.error("Error retrieving recent entries:", recentError);
          diagnostics.contextError = recentError.message || "Error retrieving recent entries";
        } else if (recentEntries && recentEntries.length > 0) {
          console.log("Retrieved recent entries:", recentEntries.length);
          
          // Store reference information
          referenceEntries = recentEntries.map(entry => ({
            id: entry.id,
            date: entry.created_at,
            snippet: entry["refined text"]?.substring(0, 100) + "...",
            type: "recent"
          }));
          
          journalContext = "Here are some of your recent journal entries:\n\n" + 
            recentEntries.map((entry, index) => {
              const date = new Date(entry.created_at).toLocaleDateString();
              const emotionsText = formatEmotions(entry.emotions);
              return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
            }).join('\n\n') + "\n\n";
            
          diagnostics.contextBuilt = true;
          diagnostics.contextSize = journalContext.length;
        }
      }
    } catch (contextError) {
      console.error("Error building context:", contextError);
      diagnostics.contextError = contextError.message || "Error building context";
    }
    
    diagnostics.processingTime.context = Date.now() - contextStartTime;
    
    // Get previous messages for context
    console.log("Fetching previous messages for conversation context...");
    const previousMessages = await getPreviousMessages(threadId);
    console.log(`Retrieved ${previousMessages.length} previous messages`);
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are SOULo, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}

Always maintain a warm, empathetic tone. If you notice concerning emotional patterns in the user's journal entries that might benefit from professional attention, 
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic.`;

    console.log("Sending to GPT with RAG context and conversation history...");
    
    // Build message history for the LLM
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add previous messages if available
    if (previousMessages.length > 0) {
      console.log("Including previous conversation context");
      messages.push(...previousMessages);
    }
    
    // Add current message
    messages.push({ role: 'user', content: message });
    
    const llmStartTime = Date.now();
    try {
      // Send to GPT with RAG context and conversation history
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GPT API error:", errorText);
        diagnostics.llmError = errorText || "Error from GPT API";
        throw new Error(`GPT API error: ${errorText}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      diagnostics.tokenCount = result.usage?.total_tokens || 0;
      diagnostics.processingTime.llm = Date.now() - llmStartTime;
      
      console.log("AI response generated successfully");
      
      diagnostics.processingTime.total = Date.now() - startTime;
      
      return new Response(
        JSON.stringify({ 
          response: aiResponse, 
          threadId: threadId,
          references: referenceEntries,
          diagnostics,
          similarityScores
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (apiError) {
      console.error("API error:", apiError);
      diagnostics.llmError = apiError.message || "API error";
      diagnostics.processingTime.total = Date.now() - startTime;
      
      // Return a 200 status even for errors to avoid CORS issues
      return new Response(
        JSON.stringify({ 
          error: apiError.message, 
          response: "I'm having trouble connecting right now. Please try again later.",
          success: false,
          diagnostics
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Error in chat-rag function:", error);
    diagnostics.processingTime.total = Date.now() - startTime;
    
    // Return 200 status even for errors to avoid CORS issues
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        success: false,
        diagnostics
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
