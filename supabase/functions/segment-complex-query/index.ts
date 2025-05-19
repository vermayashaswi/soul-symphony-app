
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      query: userQuery, 
      userId, 
      timeRange,
      vectorSearch = { matchThreshold: 0.5, matchCount: 10 }, // Default values for vector search
      appContext // New parameter for app context
    } = await req.json();

    if (!userQuery || !userId) {
      console.error('Missing user query or user ID');
      return new Response(JSON.stringify({ error: 'Missing user query or user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log(`Received query: ${userQuery} for user ID: ${userId}`);
    console.log(`App context provided: ${JSON.stringify(appContext || {}).substring(0, 100)}...`);

    // Enhanced detection to determine if this is already a single, focused question
    const isSingleQuestion = await checkIfSingleFocusedQuestion(userQuery);
    if (isSingleQuestion) {
      console.log('Detected as a single focused question - no need for segmentation');
      return new Response(JSON.stringify({ 
        data: JSON.stringify([userQuery]),
        isSingleQuestion: true 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 1. Generate embedding for the user query
    console.log('Generating embedding for the user query');
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: userQuery,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Failed to generate embedding for the query:', error);
      return new Response(JSON.stringify({ error: 'Failed to generate embedding for the query' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      console.error('Failed to generate embedding for the query');
      return new Response(JSON.stringify({ error: 'Failed to generate embedding for the query' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const queryEmbedding = embeddingData.data[0].embedding;

    // 2. Search for relevant journal entries with configurable parameters
    console.log('Searching for relevant journal entries');
    const entries = await searchJournalEntries(
      userId, 
      queryEmbedding, 
      vectorSearch.matchThreshold, 
      vectorSearch.matchCount,
      timeRange
    );

    // Process entries to ensure valid dates
    const processedEntries = entries.map(entry => ({
      ...entry,
      created_at: entry.created_at || new Date().toISOString() // Ensure created_at is not null
    }));

    // 3. Segment the complex query based on journal entries
    console.log('Segmenting the complex query based on journal entries');
    const segmentedQuery = await segmentComplexQuery(userQuery, processedEntries, apiKey, appContext);

    // 4. Return the segmented query
    console.log('Returning the segmented query');
    return new Response(JSON.stringify({ data: segmentedQuery, isSingleQuestion: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

async function searchJournalEntries(
  userId: string, 
  queryEmbedding: any[],
  matchThreshold: number = 0.5,
  matchCount: number = 10,
  timeRange?: { startDate?: Date; endDate?: Date }
) {
  try {
    console.log(`Searching journal entries for userId: ${userId}`);
    console.log(`Vector search parameters: threshold=${matchThreshold}, count=${matchCount}`);
    
    // Use the fixed function with configurable parameters
    const { data, error } = await supabase.rpc(
      'match_journal_entries_fixed',
      {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
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
    console.error('Error searching journal entries:', error);
    throw error;
  }
}

// Enhanced function to check if this is a single focused question
async function checkIfSingleFocusedQuestion(userQuery: string): Promise<boolean> {
  try {
    const prompt = `Analyze if the following user query is a single, focused question or if it contains multiple questions or complex parts that should be segmented.
      
User Query: "${userQuery}"

Instructions:
1. Look for indicators of multiple distinct questions:
   - Questions joined by "and", "also", "additionally", etc.
   - Multiple question marks
   - Questions that ask for ratings AND explanations
   - Questions that request comparisons across different domains
   - Questions asking about different time periods

2. Consider these examples:
   - "How's my sleep quality and what can I do about my anxiety?" = MULTIPLE QUESTIONS
   - "Rate my productivity out of 10" = SINGLE QUESTION
   - "How do my journal entries reflect my communication style?" = SINGLE QUESTION
   - "What patterns do you see in my happiness and how does it relate to my work?" = MULTIPLE QUESTIONS

3. Respond with just "true" if it's a single focused question, or "false" if it contains multiple questions or complex parts.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.1,
        max_tokens: 10
      }),
    });

    if (!response.ok) {
      console.error('Error checking if query is single focused');
      return false; // Default to false (treat as complex) if error
    }

    const data = await response.json();
    const result = data.choices[0].message.content.trim().toLowerCase();
    
    console.log(`Single question check result: ${result}`);
    return result === 'true';
  } catch (error) {
    console.error('Error in checkIfSingleFocusedQuestion:', error);
    return false; // Default to false (treat as complex) if error
  }
}

async function segmentComplexQuery(userQuery: string, entries: any[], apiKey: string, appContext?: any) {
  try {
    console.log('Starting query segmentation');

    // Enhanced prompt with SOULo app context and better examples
    const appContextInfo = appContext ? 
      `App Information: This is SOULo, a voice journaling app focused on mental health support and self-reflection. 
      The app helps users track emotions, detect patterns, and gain insights from their journal entries. Users can 
      ask questions about their mental health, personality traits, and emotional patterns based on their journal data.` : 
      'This is a journaling app that helps users track their emotions and thoughts.';
    
    const prompt = `You are an AI assistant for SOULo, a voice journaling app focused on mental health. 
      Your task is to segment complex user queries into simpler questions that can be answered independently.
      ${appContextInfo}
      
      User Query: ${userQuery}
      
      Relevant Journal Entries: ${JSON.stringify(entries.slice(0, 3))}
      
      Instructions:
      1. Break down the complex query into 2-4 simpler, more specific questions that can be answered separately.
      2. Focus on mental health aspects and introspection, which is the purpose of SOULo.
      3. If the user is asking about their personality traits (like "Am I introverted?"), create a specific segment focused on rating/scoring that trait.
      4. Include specific questions about patterns, emotions, and insights from the journal entries.
      5. For rating requests, create segments that ask for both the numerical rating AND explanation.
      6. Return the segments in JSON array format.
      
      Examples of good segmentation:
      
      Complex query: "Am I introverted and how do I feel about social events?"
      Segmented as:
      [
        "Based on my journal entries, would you rate me as more introverted or extroverted? Give a rating on a scale of 1-10.",
        "How do I typically feel before, during, and after social events according to my journal entries?"
      ]
      
      Complex query: "What are my main stressors and how can I manage them better?"
      Segmented as:
      [
        "What are the most common sources of stress mentioned in my journal entries?",
        "Based on my journal entries, what coping mechanisms have I found effective for managing stress?",
        "Are there any patterns in when my stress levels increase according to my journal?"
      ]
      
      Complex query: "Rate my communication skills and suggest improvements"
      Segmented as:
      [
        "Based on my journal entries, how would you rate my communication skills on a scale of 1-10?",
        "What specific strengths in communication do my journal entries reveal?",
        "What areas of communication could I improve based on patterns in my journal entries?"
      ]
      
      Now segment the user query into an array of focused questions:`;

    console.log('Calling OpenAI to segment the query with enhanced prompting');
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!completion.ok) {
      const error = await completion.text();
      console.error('Failed to segment the query:', error);
      return JSON.stringify([userQuery]); // Fall back to original query
    }

    const completionData = await completion.json();
    if (!completionData.choices || completionData.choices.length === 0) {
      console.error('Failed to segment the query');
      return JSON.stringify([userQuery]); // Fall back to original query
    }

    const segmentedQuery = completionData.choices[0].message.content;
    console.log(`Segmented query: ${segmentedQuery}`);
    
    // Try to parse the response as JSON
    try {
      // The response might be wrapped in ```json ``` or have text before/after
      const jsonMatch = segmentedQuery.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedSegments = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedSegments) && parsedSegments.length > 0) {
          console.log(`Successfully parsed ${parsedSegments.length} segments`);
          return JSON.stringify(parsedSegments);
        }
      }
      
      // If we couldn't extract a valid JSON array, try to parse the whole response
      const parsedResponse = JSON.parse(segmentedQuery);
      if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
        console.log(`Successfully parsed ${parsedResponse.length} segments from full response`);
        return JSON.stringify(parsedResponse);
      }
      
      throw new Error("Couldn't parse segments as array");
    } catch (parseError) {
      console.error('Error parsing segmented query as JSON:', parseError);
      console.log('Falling back to using the raw segmented text');
      
      // Make one more attempt to extract questions by using a pattern-based approach
      const questionLines = segmentedQuery.split('\n')
        .filter(line => line.includes('?'))
        .map(line => line.trim());
        
      if (questionLines.length > 0) {
        console.log(`Extracted ${questionLines.length} questions using pattern matching`);
        return JSON.stringify(questionLines);
      }
      
      // If parsing fails, just return the raw segmented text
      return segmentedQuery;
    }
  } catch (error) {
    console.error('Error segmenting complex query:', error);
    return JSON.stringify([userQuery]); // Fall back to original query in case of error
  }
}
