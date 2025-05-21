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

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum number of journal entries to retrieve for vector search
// Keep this reasonable for vector search to ensure quality results
const MAX_ENTRIES = 10;

/**
 * Handle the request to chat with RAG (Retrieval-Augmented Generation)
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const {
      message,
      userId,
      threadId,
      usePersonalContext = false,
      queryPlan = null,
      conversationHistory = []
    } = await req.json();

    console.log(`Processing request for user ${userId}: ${message}`);

    // Determine the appropriate query strategy based on usePersonalContext and queryPlan
    let searchStrategy = 'default';
    let filters = {};
    let needsDataAggregation = false;
    let domainContext = null;

    if (queryPlan) {
      searchStrategy = queryPlan.searchStrategy || 'hybrid';
      filters = queryPlan.filters || {};
      needsDataAggregation = queryPlan.needsDataAggregation || false;
      domainContext = queryPlan.domainContext || null;
    }

    console.log(`Using search strategy: ${searchStrategy}`);
    console.log(`Domain context: ${domainContext}`);
    console.log(`Conversation history length: ${conversationHistory.length}`);

    // Generate an OpenAI embedding for the user's message
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: message
      })
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding for query");
    }

    const { data: embeddingData } = await embeddingResponse.json();
    const embedding = embeddingData[0].embedding;

    // Different handling based on whether personal context is needed or not
    if (usePersonalContext || searchStrategy !== 'default') {
      console.log("Processing as journal-specific question");
      
      // Process the query with vector similarity search on journal entries
      return await handleJournalQuestion(message, userId, embedding, filters, searchStrategy, needsDataAggregation, conversationHistory);
    } else {
      console.log("Processing as general question (no personal context)");
      
      // Process the query as a general question without personal context
      return await handleGeneralQuestion(message, userId, conversationHistory);
    }
  } catch (error) {
    console.error("Error in chat-with-rag function:", error);
    
    return new Response(
      JSON.stringify({
        response: `I encountered an error: ${error.message}. Please try again.`,
        error: error.message
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 500
      }
    );
  }
});

/**
 * Handle general questions that don't require personal context
 */
async function handleGeneralQuestion(message, userId, conversationHistory = []) {
  try {
    console.log("Handling general question");
    
    // Call OpenAI to process the general question
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful conversational assistant. Respond naturally to the user's queries without referencing any specific personal data unless provided."
          },
          ...conversationHistory,
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error from OpenAI:", error);
      throw new Error("Failed to generate response");
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    return new Response(
      JSON.stringify({
        response: answer,
        references: []
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error("Error in handleGeneralQuestion:", error);
    throw error;
  }
}

/**
 * Handle journal questions that require personal context
 */
async function handleJournalQuestion(message, userId, embedding, filters = {}, searchStrategy = 'hybrid', needsDataAggregation = false, conversationHistory = []) {
  try {
    console.log("Handling journal question");
    
    // Step 1: Search for relevant journal entries using the appropriate strategy
    let relevantEntries = [];
    let textSearchEntries = [];
    let vectorSearchEntries = [];
    
    console.log(`Searching for relevant journal entries using strategy: ${searchStrategy}`);
    
    // Apply the search strategy
    if (searchStrategy === 'text' || searchStrategy === 'hybrid') {
      try {
        console.log("Performing text search");
        textSearchEntries = await searchEntriesWithSQL(userId, message, filters);
        console.log(`Found ${textSearchEntries.length} entries with text search`);
      } catch (error) {
        console.error("Error in text search:", error);
      }
    }
    
    if (searchStrategy === 'vector' || searchStrategy === 'hybrid') {
      try {
        console.log("Performing vector search");
        vectorSearchEntries = await searchEntriesWithVector(userId, embedding, filters);
        console.log(`Found ${vectorSearchEntries.length} entries with vector search`);
      } catch (error) {
        console.error("Error in vector search:", error);
      }
    }
    
    // Merge results depending on search strategy
    if (searchStrategy === 'hybrid') {
      const entryIds = new Set();
      relevantEntries = [];
      
      // First add vector search results (typically higher quality)
      for (const entry of vectorSearchEntries) {
        if (!entryIds.has(entry.id)) {
          entryIds.add(entry.id);
          relevantEntries.push(entry);
        }
      }
      
      // Then add text search results that weren't already added
      for (const entry of textSearchEntries) {
        if (!entryIds.has(entry.id)) {
          entryIds.add(entry.id);
          relevantEntries.push(entry);
        }
      }
      
    } else if (searchStrategy === 'vector') {
      relevantEntries = vectorSearchEntries;
    } else {
      relevantEntries = textSearchEntries;
    }
    
    // Limit number of entries for vector search to keep context manageable
    // But don't limit for time pattern analysis - we want all entries for that
    if (relevantEntries.length > MAX_ENTRIES && !message.toLowerCase().includes('time') && !message.toLowerCase().includes('pattern')) {
      console.log(`Limiting entries from ${relevantEntries.length} to ${MAX_ENTRIES} for vector search`);
      relevantEntries = relevantEntries.slice(0, MAX_ENTRIES);
    } else {
      console.log(`Using all ${relevantEntries.length} relevant entries for analysis`);
    }
    
    console.log(`Total relevant entries found: ${relevantEntries.length}`);
    
    if (relevantEntries.length === 0) {
      console.log("No relevant journal entries found");
      return new Response(
        JSON.stringify({
          response: "I don't see any journal entries that match what you're asking about. Could you try asking something else or provide more context?",
          references: []
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    // Step 2: Format entries for the prompt
    let journalContext = "";
    const references = [];
    
    for (const entry of relevantEntries) {
      // Ensure we use the correct content field from journal entries
      const entryContent = entry.content || COALESCE(entry["refined text"], entry["transcription text"]) || "";
      const formattedDate = new Date(entry.created_at).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Add entry to context
      journalContext += `Journal entry from ${formattedDate}:\n${entryContent}\n\n`;
      
      // Add entry to references (for citation in UI)
      references.push({
        id: entry.id,
        date: entry.created_at,
        snippet: entryContent.substring(0, 150) + (entryContent.length > 150 ? "..." : "")
      });
    }
    
    // Format conversation history for the prompt
    let conversationContextText = "";
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContextText = "\n\nRecent conversation history:\n";
      conversationHistory.forEach((msg, i) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        conversationContextText += `${role}: ${msg.content}\n`;
      });
      conversationContextText += "\n";
    }
    
    // Step 3: Call OpenAI to process the query with journal context
    const messages = [
      {
        role: "system",
        content: `You are a helpful personal assistant that helps users reflect on and analyze their journal entries. You have access to the following journal entries from the user:

${journalContext}

${conversationContextText}

Based on these entries and conversation history, help the user by answering their question. If the information in the entries is not sufficient to answer the question completely, clearly state what is missing. Stay factual and only make conclusions that are directly supported by the journal entries. When references temporal information, try to be specific about dates. Be empathetic, personal, and thoughtful in your responses.`
      },
      // Don't add conversation history here since we've included it in the system prompt
      { role: "user", content: message }
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error from OpenAI:", error);
      throw new Error("Failed to generate response");
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    return new Response(
      JSON.stringify({
        response: answer,
        references: references
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error("Error handling journal question:", error);
    throw error;
  }
}

/**
 * Helper function to coalesce values (similar to SQL COALESCE)
 */
function COALESCE(...args) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== null && args[i] !== undefined) {
      return args[i];
    }
  }
  return null;
}

/**
 * Search journal entries using SQL-based text search with filters
 */
async function searchEntriesWithSQL(userId, query, filters = {}) {
  try {
    // Start building the query - don't limit for time pattern analysis
    let queryBuilder = supabase
      .from('Journal Entries')
      .select('id, "refined text", "transcription text", created_at, master_themes, emotions')
      .eq('user_id', userId);
    
    // Apply date range filters if provided
    if (filters.dateRange) {
      if (filters.dateRange.startDate) {
        queryBuilder = queryBuilder.gte('created_at', filters.dateRange.startDate);
      }
      if (filters.dateRange.endDate) {
        queryBuilder = queryBuilder.lte('created_at', filters.dateRange.endDate);
      }
    }
    
    // Apply full-text search on content and themes
    // Note: We search in both refined text and transcription text columns since there's no content column
    const searchTerms = query.split(' ').filter(term => term.length > 3).join(' | ');
    if (searchTerms) {
      queryBuilder = queryBuilder.or(`"refined text".ilike.%${searchTerms}%, "transcription text".ilike.%${searchTerms}%`);
    }
    
    // Execute the query
    const { data: entries, error } = await queryBuilder
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error in SQL search:", error);
      throw error;
    }
    
    // Map the results to include a proper content field
    const mappedEntries = entries.map(entry => {
      return {
        ...entry,
        content: COALESCE(entry["refined text"], entry["transcription text"]) || ""
      };
    });
    
    return mappedEntries;
  } catch (error) {
    console.error("Error in text search:", error);
    throw error;
  }
}

/**
 * Search journal entries using vector similarity with filters
 */
async function searchEntriesWithVector(userId, embedding, filters = {}) {
  try {
    let matchFn = 'match_journal_entries_fixed';
    const params = {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: MAX_ENTRIES, // Keep this limit for vector search for quality
      user_id_filter: userId
    };
    
    // Use date-aware function if date range filters are provided
    if (filters.dateRange && (filters.dateRange.startDate || filters.dateRange.endDate)) {
      matchFn = 'match_journal_entries_with_date';
      params.start_date = filters.dateRange.startDate || null;
      params.end_date = filters.dateRange.endDate || null;
    }
    
    // Call the appropriate database function for vector search
    const { data: entries, error } = await supabase.rpc(matchFn, params);
    
    if (error) {
      console.error(`Error in vector search using ${matchFn}:`, error);
      throw error;
    }
    
    // Map the results to include a proper content field
    const mappedEntries = entries.map(entry => {
      return {
        ...entry,
        // Ensure we have a content field that uses the correct data
        content: COALESCE(entry["refined text"], entry["transcription text"], entry.content) || ""
      };
    });
    
    return mappedEntries;
  } catch (error) {
    console.error("Error searching entries with vector:", error);
    throw error;
  }
}
