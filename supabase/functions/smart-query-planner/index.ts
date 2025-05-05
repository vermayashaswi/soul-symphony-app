
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import OpenAI from "https://deno.land/x/openai@v4.27.0/mod.ts";
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openai = new OpenAI(openAIApiKey);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Utility function to extract text content from HTML
function extractTextFromHTML(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc ? doc.body.textContent : '';
}

// Utility function to count journal entries for a user
async function countJournalEntries(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('Journal Entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error("Error counting journal entries:", error);
    return 0;
  }

  return count || 0;
}

// Enhanced function to get emotions data from the emotions table
async function getEmotionsData(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('emotions')
      .select('name, description')
      .order('name');
      
    if (error) {
      console.error("Error fetching emotions data:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in getEmotionsData:", error);
    return [];
  }
}

// Enhanced function to get comprehensive entity data
async function getEntityData(userId: string, limit = 20): Promise<any> {
  try {
    // Get entity categories and examples
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('entities')
      .eq('user_id', userId)
      .not('entities', 'is', null)
      .limit(limit);
    
    if (error) {
      console.error("Error fetching entities data:", error);
      return { types: [], examples: {}, recent: [] };
    }
    
    // Extract unique entity types and examples
    const entityTypes = new Set();
    const entityExamples: Record<string, Set<string>> = {};
    const recentEntities: Array<{type: string, name: string}> = [];
    
    data?.forEach(entry => {
      if (entry.entities && Array.isArray(entry.entities)) {
        entry.entities.forEach((entity: any) => {
          if (entity && entity.type && entity.name) {
            // Add to types
            entityTypes.add(entity.type);
            
            // Add to examples
            if (!entityExamples[entity.type]) {
              entityExamples[entity.type] = new Set();
            }
            
            entityExamples[entity.type].add(entity.name);
            
            // Add to recent entities (limited number)
            if (recentEntities.length < 50) {
              recentEntities.push({
                type: entity.type,
                name: entity.name
              });
            }
          }
        });
      }
    });
    
    // Format the entity data
    const entityData = {
      types: Array.from(entityTypes),
      examples: Object.fromEntries(
        Object.entries(entityExamples).map(([type, names]) => [type, Array.from(names).slice(0, 10)])
      ),
      recent: recentEntities
    };
    
    return entityData;
  } catch (error) {
    console.error("Error in getEntityData:", error);
    return { types: [], examples: {}, recent: [] };
  }
}

// Get sample data structures
async function getSampleDataStructures(userId: string): Promise<any> {
  try {
    // Fix: Use quoted column names for columns with spaces
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('emotions, entityemotion, master_themes, "refined text", "transcription text", sentiment')
      .eq('user_id', userId)
      .not('emotions', 'is', null)
      .limit(3);
    
    if (error) {
      console.error("Error fetching sample data structures:", error);
      return {};
    }
    
    // Process and clean up samples for inclusion in prompt
    const samples: any = {
      emotions: [],
      entityemotion: [],
      master_themes: [],
      sentiment: [],
      content_samples: []
    };
    
    data?.forEach(entry => {
      if (entry.emotions && !samples.emotions.length) {
        samples.emotions.push(entry.emotions);
      }
      
      if (entry.entityemotion && !samples.entityemotion.length) {
        samples.entityemotion.push(entry.entityemotion);
      }
      
      if (entry.master_themes && Array.isArray(entry.master_themes) && !samples.master_themes.length) {
        samples.master_themes.push(entry.master_themes);
      }
      
      if (entry.sentiment && samples.sentiment.length < 2) {
        samples.sentiment.push(entry.sentiment);
      }
      
      // Fix: Use correct column access with spaces
      const content = entry["refined text"] || entry["transcription text"];
      if (content && samples.content_samples.length < 2) {
        // Truncate content for brevity
        const truncated = content.length > 200 
          ? content.substring(0, 200) + '...' 
          : content;
        samples.content_samples.push(truncated);
      }
    });
    
    return samples;
  } catch (error) {
    console.error("Error in getSampleDataStructures:", error);
    return {};
  }
}

// Enhanced function to get detailed schema information
async function getEnhancedSchemaInfo(): Promise<string> {
  try {
    const { data: columnData, error: columnError } = await supabase.rpc(
      'check_table_columns',
      { table_name: 'Journal Entries' }
    );
    
    if (columnError) {
      console.error("Error getting table schema:", columnError);
      throw columnError;
    }
    
    // Add column descriptions with detailed explanations
    const columnDescriptions: Record<string, string> = {
      'id': 'Primary key for the journal entry',
      'user_id': 'UUID of the user who created the journal entry, references auth.users',
      'created_at': 'Timestamp when the journal entry was created, supports time-based queries',
      'transcription text': 'Original text from voice recording transcription',
      'refined text': 'Processed version of the transcription with improvements',
      'audio_url': 'URL to the audio recording if the entry was created via voice',
      'duration': 'Length of the audio recording in seconds',
      'emotions': 'JSONB array containing emotion analysis with scores (e.g. {"joy": 0.8, "calm": 0.6})',
      'sentiment': 'Overall sentiment classification (positive, negative, neutral)',
      'entities': 'JSONB array of entities detected in the text with their types and names',
      'master_themes': 'Text array of high-level themes extracted from the entry',
      'themes': 'Text array of more specific themes extracted from the entry',
      'user_feedback': 'Optional feedback from the user about the entry',
      'Edit_Status': 'Integer flag indicating if the entry has been edited (0=not edited)',
      'entityemotion': 'JSONB mapping entities to associated emotions',
      'original_language': 'The original language the entry was written in',
      'translation_text': 'Translated version of the content if in a different language'
    };
    
    // Format schema with descriptions
    const enhancedSchema = columnData.map(col => 
      `${col.column_name} (${col.data_type})${columnDescriptions[col.column_name] ? ' - ' + columnDescriptions[col.column_name] : ''}`
    ).join('\n');
    
    // Additional table relationships and schema notes
    const schemaExplanation = `
Journal Entries Table Schema Notes:
- The emotions field is a JSONB object mapping emotion names to intensity scores (0.0-1.0)
- The entities field contains structured data about people, places, etc. mentioned in entries
- The entityemotion field links entities to associated emotions
- The master_themes field contains high-level categories for the entry content
- Temporal queries can use the created_at field which is indexed
- Sentiment values are typically "positive", "negative", or "neutral"
- IMPORTANT: Column names with spaces like "refined text" and "transcription text" must be quoted in SQL queries
    `;
    
    return enhancedSchema + '\n\n' + schemaExplanation;
  } catch (error) {
    console.error("Error getting enhanced schema info:", error);
    return "Schema information unavailable";
  }
}

// Utility function to get date range based on time range
function getDateRangeForTimeframe(timeframe: string): { startDate: string, endDate: string } {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  // Set end date to current time
  endDate = now;

  // Calculate start date based on timeframe
  if (timeframe === 'last month' || timeframe === 'previous month') {
    // First day of previous month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Last day of previous month
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (timeframe === 'this month' || timeframe === 'current month') {
    // First day of current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    // Current day
    endDate = now;
  } else if (timeframe === 'last week' || timeframe === 'previous week') {
    // Start of previous week (Monday)
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 7;
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    // End of previous week (Sunday)
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (timeframe === 'this week' || timeframe === 'current week') {
    // Start of current week (Monday)
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    // Current day
    endDate = now;
  } else if (timeframe === 'yesterday') {
    // Yesterday
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (timeframe === 'today') {
    // Today
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
  } else if (timeframe === 'last year' || timeframe === 'previous year') {
    // Last year
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (timeframe === 'this year' || timeframe === 'current year') {
    // This year
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
  } else {
    // Default to last 30 days if timeframe not recognized
    startDate = new Date();
    startDate.setDate(now.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

// Step 1: Query Classification with GPT
async function classifyQuery(query: string, conversationContext: any[] = []) {
  try {
    const prompt = `You are the assistant engine inside the SOuLO voice journaling app. A user has asked the following query:
    
    "${query}"
    
    You also have access to the user's journal database schema and the conversation history so far. Based on this, classify the query into one of the following:
    - "journal_specific": The query relates to journal entries, experiences, or emotions the user has recorded.
    - "mental_health_general": The query is about mental wellness, coping strategies, self-care, or emotional regulation but not tied to journal entries.
    - "general_irrelevant": The query is not related to journaling, mental health, or spirituality.
    
    Respond ONLY with the label: journal_specific / mental_health_general / general_irrelevant`;

    let messages = [{ role: "system", content: prompt }];
    
    // Add conversation context if available
    if (conversationContext && conversationContext.length > 0) {
      // Add a limited amount of previous messages for context
      const limitedContext = conversationContext.slice(-5); // Last 5 messages
      limitedContext.forEach(msg => {
        messages.push({ 
          role: msg.sender === 'user' ? 'user' : 'assistant', 
          content: msg.content 
        });
      });
    }
    
    messages.push({ role: "user", content: query });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.1,
      max_tokens: 50
    });

    const classification = response.choices[0].message.content.trim().toLowerCase();
    console.log(`Query classified as: ${classification}`);
    
    // Normalize the response to one of our expected values
    if (classification.includes('journal_specific')) {
      return 'journal_specific';
    } else if (classification.includes('mental_health_general')) {
      return 'mental_health_general';
    } else {
      return 'general_irrelevant';
    }
  } catch (error) {
    console.error("Error classifying query:", error);
    // Default to journal_specific as a safe fallback
    return 'journal_specific';
  }
}

// Step 2: Query Planning with GPT - Updated for simplified strategies and flexible filters
async function createQueryPlan(query: string, userId: string, conversationContext: any[] = []) {
  try {
    const entryCount = await countJournalEntries(userId);
    
    // Get enhanced schema information with column descriptions
    const enhancedSchema = await getEnhancedSchemaInfo();
    
    // Get comprehensive emotions data
    const emotionsData = await getEmotionsData();
    
    // Get comprehensive entity data
    const entityData = await getEntityData(userId);
    
    // Get sample data structures
    const sampleStructures = await getSampleDataStructures(userId);
    
    // Format emotions data for inclusion in the prompt
    const emotionsInfo = emotionsData.length > 0 
      ? `Available emotions in the database:\n${emotionsData.map(e => `- ${e.name}${e.description ? ': ' + e.description : ''}`).join('\n')}`
      : 'Emotions data unavailable';
    
    // Format entity data for inclusion in the prompt
    const entitiesInfo = entityData.types.length > 0
      ? `Entity types found in user's journal:\n${entityData.types.map(type => 
          `- ${type}${entityData.examples[type]?.length > 0 ? ' (Examples: ' + entityData.examples[type].join(', ') + ')' : ''}`
        ).join('\n')}`
      : 'Entity categories unavailable';
    
    // Format sample data structures
    let dataStructuresInfo = 'Sample data structures:';
    
    if (sampleStructures.emotions && sampleStructures.emotions.length) {
      dataStructuresInfo += `\n\nSample emotions JSON structure:\n${JSON.stringify(sampleStructures.emotions[0], null, 2)}`;
    }
    
    if (sampleStructures.entityemotion && sampleStructures.entityemotion.length) {
      dataStructuresInfo += `\n\nSample entityemotion JSON structure:\n${JSON.stringify(sampleStructures.entityemotion[0], null, 2)}`;
    }
    
    if (sampleStructures.master_themes && sampleStructures.master_themes.length) {
      dataStructuresInfo += `\n\nSample master_themes array structure:\n${JSON.stringify(sampleStructures.master_themes[0], null, 2)}`;
    }
    
    if (sampleStructures.sentiment && sampleStructures.sentiment.length) {
      dataStructuresInfo += `\n\nSample sentiment values:\n${JSON.stringify(sampleStructures.sentiment, null, 2)}`;
    }
    
    if (sampleStructures.content_samples && sampleStructures.content_samples.length) {
      dataStructuresInfo += `\n\nSample entry content:\n${sampleStructures.content_samples.join('\n\n')}`;
    }
    
    // Add recent entities for better context
    const recentEntitiesInfo = entityData.recent.length > 0
      ? `\n\nRecent entities mentioned in journal:\n${JSON.stringify(entityData.recent.slice(0, 20), null, 2)}`
      : '';
    
    // Create an enhanced prompt with all the additional information
    const prompt = `You are an expert query analyzer for a personal journal application. Your task is to analyze user queries and create a structured plan for retrieving relevant information from a database.
      
      Here is the full journal schema with detailed descriptions:
      ${enhancedSchema}
      
      ${emotionsInfo}
      
      ${entitiesInfo}
      ${recentEntitiesInfo}
      
      ${dataStructuresInfo}
      
      The user has ${entryCount} journal entries.
      
      IMPORTANT: The database has columns with spaces in their names, like "refined text" and "transcription text". 
      These must be properly quoted in any SQL queries.
      
      Your output should be a JSON object with:
      - "is_segmented": true/false (whether query needs to be broken down)
      - "subqueries": [array of sub-questions if segmented]
      - "strategy": "vector", "sql", or "hybrid" 
      - "filters": { 
          "date_range": { "startDate": ISO date or null, "endDate": ISO date or null, "periodName": string description },
          "emotions": [array of emotions to filter by],
          "sentiment": [array of sentiment values to filter by],
          "themes": [array of themes to filter by],
          "entities": [array of entity objects with type and name]
        }
      - "match_count": number of matches to return (10-30 based on query complexity)
      - "needs_data_aggregation": true/false (whether results need to be analyzed together)
      - "needs_more_context": true/false (whether more entries than usual should be fetched)
      - "reasoning": why this strategy works best
      
      Include only what's applicable to this specific query. Filters are flexible and will be applied based on the selected strategy.
      
      Query examples and recommended strategies:
      1. "Show me entries about happiness" → Use "vector" strategy with emotion filters
      2. "What did I write about last Monday?" → Use "vector" strategy with date_range filter
      3. "How has my sleep been changing?" → Use "hybrid" strategy with theme filters and data aggregation
      4. "What makes me anxious about work?" → Use "hybrid" strategy with emotion and theme filters
      5. "When was the last time I felt excited?" → Use "sql" strategy with emotion filter and sorting
      
      Generate precise, actionable query plans focused on retrieving the most relevant journal entries for the user's question.`;

    let messages = [{ role: "system", content: prompt }];
    
    // Add conversation context if available
    if (conversationContext && conversationContext.length > 0) {
      // Summarize conversation context
      const contextSummary = `Previous conversation context (${conversationContext.length} messages):\n` +
        conversationContext.slice(-5).map(msg => 
          `${msg.sender}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
        ).join('\n');
      
      messages.push({ role: "user", content: contextSummary });
    }
    
    messages.push({ role: "user", content: query });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const planText = response.choices[0].message.content || "{}";
    console.log("Generated query plan:", planText);
    
    // Try to parse the response as JSON
    try {
      const plan = JSON.parse(planText);
      return plan;
    } catch (parseError) {
      console.error("Error parsing query plan:", parseError);
      return {
        strategy: "vector",
        match_count: 10,
        is_segmented: false,
        needs_data_aggregation: false,
        needs_more_context: false,
        filters: {}
      };
    }
  } catch (error) {
    console.error("Error creating query plan:", error);
    return {
      strategy: "vector",
      match_count: 10,
      is_segmented: false,
      needs_data_aggregation: false,
      needs_more_context: false,
      filters: {}
    };
  }
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId, conversationContext } = await req.json();
    
    if (!message) {
      throw new Error("Message is required");
    }
    
    if (!userId) {
      throw new Error("User ID is required");
    }
    
    console.log(`Processing query planner request for user ${userId} with message: ${message.substring(0, 50)}...`);
    
    // Step 1: Classify the query
    const queryType = await classifyQuery(message, conversationContext);
    console.log(`Query classified as: ${queryType}`);
    
    // For non-journal-specific queries, we'll return early
    if (queryType !== 'journal_specific') {
      return new Response(
        JSON.stringify({
          queryType,
          plan: null,
          directResponse: queryType === 'general_irrelevant' ? 
            "I'm designed to help with your journal entries and mental wellbeing. I can't assist with unrelated topics, but I'm here if you'd like to discuss your journaling or well-being." : null
        }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // Step 2: Create a query plan for journal-specific queries
    const queryPlan = await createQueryPlan(message, userId, conversationContext);
    
    // Return the plan
    return new Response(
      JSON.stringify({
        queryType,
        plan: queryPlan,
        directResponse: null
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in smart query planner:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        queryType: 'journal_specific', // Default to this for error cases
        plan: {
          strategy: "vector",
          match_count: 10,
          is_segmented: false,
          needs_data_aggregation: false,
          needs_more_context: false,
          filters: {}
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
