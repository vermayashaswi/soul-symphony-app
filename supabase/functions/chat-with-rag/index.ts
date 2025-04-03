
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.3.0";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

// Use local versions of these modules instead of trying to import from src/utils
import { analyzeQueryTypes } from "./queryAnalyzer.ts";
import { getEmotionInsights } from "./emotionAnalytics.ts";
import { findMentionedEntities } from "./entityAnalytics.ts";

// Set up required environment variables and clients
const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Initialize OpenAI and Supabase clients
const configuration = new Configuration({ apiKey: openAiKey });
const openai = new OpenAIApi(configuration);
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// Set up CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define types for the response
interface ChatResponse {
  role: string;
  content: string;
  references?: any[];
  analysis?: any;
  hasNumericResult?: boolean;
}

// Main request handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request
    const { message: query, userId, queryTypes, threadId, requiresFiltering, timeRange: timeRangeInput } = await req.json();
    
    if (!query || !userId) {
      throw new Error("Missing required parameters: query or userId");
    }

    console.log(`Processing query for user ${userId}: ${query}`);
    
    // Analyze the query if queryTypes was not provided
    const analyzedQueryTypes = queryTypes || analyzeQueryTypes(query);
    console.log("Query analysis:", analyzedQueryTypes);

    // Generate embedding for the query
    const embeddingResponse = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: query,
    });

    const queryEmbedding = embeddingResponse.data.data[0].embedding;
    
    // Store the query in the database
    try {
      await supabase.rpc("store_user_query", {
        user_id: userId,
        query_text: query,
        query_embedding: queryEmbedding,
        thread_id: threadId
      });
    } catch (error) {
      // Non-critical error, log but continue
      console.error("Error storing user query:", error);
    }

    // Determine time range from query analysis
    const timeRange = prepareTimeRange(timeRangeInput || analyzedQueryTypes.timeRange || {});
    console.log("Time range:", timeRange);

    // Different retrieval strategies based on query type
    let references = [];
    let analysisData = null;
    let hasNumericResult = false;

    // If filtering is required, filter journal entries first
    if (requiresFiltering || analyzedQueryTypes.requiresFiltering) {
      console.log("Applying filters to journal entries");
      
      let filteredEntriesQuery = supabase
        .from('Journal Entries')
        .select('id, "refined text", created_at, emotions, master_themes')
        .eq('user_id', userId);
      
      // Apply time range filters if present
      if (timeRange.startDate) {
        filteredEntriesQuery = filteredEntriesQuery.gte('created_at', timeRange.startDate);
      }
      
      if (timeRange.endDate) {
        filteredEntriesQuery = filteredEntriesQuery.lte('created_at', timeRange.endDate);
      }
      
      // Execute the query to get filtered entries
      const { data: filteredEntries, error } = await filteredEntriesQuery;
      
      if (!error && filteredEntries && filteredEntries.length > 0) {
        console.log(`Found ${filteredEntries.length} entries after filtering`);
        
        // Prepare references
        references = filteredEntries.map(entry => ({
          id: entry.id,
          text: entry["refined text"],
          created_at: entry.created_at,
          emotions: entry.emotions,
          master_themes: entry.master_themes
        }));
      } else {
        console.log("No entries found after filtering or error occurred:", error);
      }
    }
    // 1. Emotion-focused queries
    else if (analyzedQueryTypes.isEmotionFocused) {
      // Extract emotion from query
      const emotion = extractTargetEmotion(query);
      
      if (emotion) {
        console.log(`Found emotion focus: ${emotion}`);
        // Get emotional insights
        const emotionInsights = await getEmotionInsights(
          supabase, 
          userId, 
          emotion,
          timeRange
        );
        
        if (emotionInsights.entries && emotionInsights.entries.length > 0) {
          references = emotionInsights.entries;
          analysisData = {
            type: "emotion",
            data: emotionInsights
          };
          
          if (analyzedQueryTypes.isQuantitative) {
            hasNumericResult = true;
          }
        }
      }
    }
    
    // 2. Entity-focused queries
    else if (analyzedQueryTypes.isEntityFocused) {
      // Extract entity from query
      const entity = extractNamedEntity(query);
      
      if (entity) {
        console.log(`Found entity focus: ${entity}`);
        // Get entity insights
        const entityInsights = await findMentionedEntities(
          supabase,
          userId,
          entity,
          timeRange
        );
        
        if (entityInsights.entries && entityInsights.entries.length > 0) {
          references = entityInsights.entries;
          analysisData = {
            type: "entity",
            data: entityInsights
          };
          
          if (analyzedQueryTypes.isQuantitative) {
            hasNumericResult = true;
          }
        }
      }
    }
    
    // 3. Default semantic search as fallback
    if (references.length === 0) {
      console.log("Using vector similarity search");
      
      const { data: vectorResults, error: vectorError } = await supabase.rpc(
        "match_journal_entries_with_date",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 5,
          user_id_filter: userId,
          start_date: timeRange.startDate,
          end_date: timeRange.endDate
        }
      );
      
      if (vectorError) {
        console.error("Error in vector search:", vectorError);
      } else if (vectorResults && vectorResults.length > 0) {
        references = vectorResults;
      }
    }

    console.log(`Found ${references.length} references`);

    // Prepare prompt template based on query types and references
    const systemPrompt = generateSystemPrompt(analyzedQueryTypes, references);
    
    // Call OpenAI API with our tailored prompt
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    // Format references for the response
    const formattedReferences = references.map((ref: any) => {
      return {
        id: ref.id,
        content: ref.text || ref.content,
        date: ref.created_at,
        similarity: ref.similarity || null
      };
    });

    // Prepare the final response
    const chatResponse: ChatResponse = {
      role: "assistant",
      content: response.data.choices[0].message?.content || 
               "I couldn't generate a response at this time.",
      references: formattedReferences,
      hasNumericResult
    };
    
    if (analysisData) {
      chatResponse.analysis = analysisData;
    }

    // Return the formatted response
    return new Response(JSON.stringify(chatResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    
    return new Response(
      JSON.stringify({
        role: "error",
        content: `Error processing your request: ${error.message}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper functions
function prepareTimeRange(targetTimeRange: any) {
  const now = new Date();
  let startDate = null;
  let endDate = null;
  
  if (targetTimeRange && targetTimeRange.type) {
    switch (targetTimeRange.type) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        endDate = new Date().toISOString();
        break;
      case 'yesterday':
        startDate = new Date(now.setDate(now.getDate() - 1)).toISOString();
        startDate = new Date(new Date(startDate).setHours(0, 0, 0, 0)).toISOString();
        endDate = new Date(new Date(startDate).setHours(23, 59, 59, 999)).toISOString();
        break;
      case 'week':
        startDate = getStartOfWeek(now).toISOString();
        endDate = new Date().toISOString();
        break;
      case 'lastWeek':
        startDate = getStartOfWeek(new Date(now.setDate(now.getDate() - 7))).toISOString();
        endDate = getEndOfWeek(new Date(startDate)).toISOString();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        endDate = new Date().toISOString();
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        endDate = new Date().toISOString();
        break;
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1).toISOString();
        endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999).toISOString();
        break;
      case 'recent': // Default to last 7 days
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
        endDate = new Date().toISOString();
        break;
      default:
        // No specific time range mentioned
        break;
    }
  }
  
  // If explicit dates were provided in the query analysis, use those
  if (targetTimeRange && targetTimeRange.startDate) {
    startDate = targetTimeRange.startDate;
  }
  if (targetTimeRange && targetTimeRange.endDate) {
    endDate = targetTimeRange.endDate;
  }
  
  return { type: targetTimeRange && targetTimeRange.type, startDate, endDate };
}

// Helper functions for date calculations
function getStartOfWeek(date: Date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(date.setDate(diff));
}

function getEndOfWeek(date: Date) {
  const startOfWeek = getStartOfWeek(new Date(date));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

// Extract target emotion from the query
function extractTargetEmotion(query: string) {
  const commonEmotions = [
    'joy', 'happy', 'happiness', 'sad', 'sadness', 'anger', 'angry', 
    'fear', 'afraid', 'scared', 'disgust', 'disgusted', 'surprise', 'surprised',
    'love', 'loved', 'hate', 'hated', 'content', 'contented', 'calm',
    'peaceful', 'anxious', 'anxiety', 'worried', 'worry', 'stress', 'stressed',
    'depressed', 'depression', 'excited', 'excitement', 'guilt', 'guilty',
    'shame', 'ashamed', 'proud', 'pride', 'grateful', 'gratitude',
    'hopeful', 'hope', 'optimistic', 'optimism', 'pessimistic', 'pessimism',
    'confident', 'confidence', 'insecure', 'insecurity', 'jealous', 'jealousy',
    'envious', 'envy', 'lonely', 'loneliness', 'frustrated', 'frustration',
    'bored', 'boredom', 'confused', 'confusion', 'disappointed', 'disappointment',
    'embarrassed', 'embarrassment', 'satisfied', 'satisfaction'
  ];
  
  const lowerQuery = query.toLowerCase();
  
  // First try direct match
  for (const emotion of commonEmotions) {
    if (lowerQuery.includes(emotion)) {
      return emotion;
    }
  }
  
  // Look for patterns like "I feel X" or "how I felt"
  const feelingPatterns = [
    /how (?:do|did) i feel/i,
    /my (?:feelings|emotions)/i,
    /i (?:feel|felt|am feeling)/i,
    /feeling (\w+)/i,
    /emotion(?:s)? (?:of|like|such as) (\w+)/i
  ];
  
  for (const pattern of feelingPatterns) {
    if (pattern.test(lowerQuery)) {
      return "general_emotion";
    }
  }
  
  return null;
}

// Extract named entity from the query
function extractNamedEntity(query: string) {
  // Simple pattern matching for entity extraction
  // This is a basic implementation - could be improved with NLP
  
  const lowerQuery = query.toLowerCase();
  
  // Look for patterns like "find entries about X" or "tell me about X"
  const entityPatterns = [
    /(?:about|regarding|concerning|mentioning|involving) ([a-z0-9 ]+)/i,
    /(?:find|search for|look for) ([a-z0-9 ]+)/i,
    /(?:entries|posts|journals) (?:about|on|regarding) ([a-z0-9 ]+)/i
  ];
  
  for (const pattern of entityPatterns) {
    const match = lowerQuery.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted entity
      let entity = match[1].trim();
      
      // Remove common stopwords from the beginning
      const stopwords = ['the', 'a', 'an', 'my', 'our', 'their', 'his', 'her'];
      for (const stopword of stopwords) {
        if (entity.startsWith(stopword + ' ')) {
          entity = entity.substring(stopword.length + 1);
        }
      }
      
      return entity;
    }
  }
  
  // If no pattern match, check for quoted text which often indicates an entity
  const quotedTextMatch = query.match(/"([^"]+)"|'([^']+)'/);
  if (quotedTextMatch) {
    return (quotedTextMatch[1] || quotedTextMatch[2]).trim();
  }
  
  return null;
}

// Generate system prompt for the AI
function generateSystemPrompt(queryTypes: any, references: any[]) {
  let basePrompt = `You are a helpful assistant analyzing journal entries. Based on the user's query, I've found ${references.length} relevant entries.`;
  
  if (references.length > 0) {
    basePrompt += `\n\nHere are the relevant journal entries (newest first):`;
    
    references.forEach((ref, index) => {
      const date = new Date(ref.created_at || ref.date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      basePrompt += `\n\nEntry ${index + 1} (${date}):\n${ref.text || ref.content}`;
    });
  } else {
    basePrompt += `\n\nI couldn't find any journal entries that are relevant to the query.`;
  }
  
  // Add specific instructions based on query types
  basePrompt += "\n\nIn your response:";
  
  if (queryTypes.isEmotionFocused) {
    basePrompt += "\n- Focus on emotional patterns and feelings mentioned in the entries.";
    
    if (queryTypes.isQuantitative) {
      basePrompt += "\n- Include quantitative analysis of emotions where possible (e.g., frequency, intensity).";
    }
  }
  
  if (queryTypes.requiresFiltering || queryTypes.isTimeFocused || queryTypes.isTemporal) {
    basePrompt += "\n- Pay attention to temporal patterns and changes over time in the filtered entries.";
  }
  
  if (queryTypes.isEntityFocused) {
    basePrompt += "\n- Focus on the specific people, places, or things mentioned in the entries.";
  }
  
  if (queryTypes.isWhyQuestion) {
    basePrompt += "\n- Provide potential explanations or reasons based strictly on the content of the entries.";
  }
  
  if (queryTypes.isComparison) {
    basePrompt += "\n- Compare and contrast different aspects mentioned in the entries.";
  }
  
  // General guidelines
  basePrompt += `\n
- Answer directly using information from the journal entries only.
- If the entries don't contain information needed to answer the query, clearly state this.
- DO NOT make up or invent information not present in the entries.
- Keep your response clear, concise, and directly relevant to the user's query.
- Reference specific entries by their number when appropriate.
- If appropriate, briefly summarize key insights at the beginning of your response.
- If you need to calculate numbers or aggregations, calculate them accurately based on the entries provided.`;
  
  return basePrompt;
}
