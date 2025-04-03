
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.3.0";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";
import { analyzeQueryTypes } from "../../src/utils/chat/queryAnalyzer.ts";
import { calculateTopEmotions, findStrongestEmotionOccurrence, countKeywordOccurrences } from "./emotionAnalytics.ts";
import { searchEntriesByEntity, analyzeEntitySentiment, findCommonEntities } from "./entityAnalytics.ts";

// Environment setup
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create a Supabase client with the service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configure OpenAI
const openaiConfig = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Anti-hallucination system message part
const ANTI_HALLUCINATION_INSTRUCTIONS = `
IMPORTANT: You should only make factual statements that are directly supported by the provided journal entries.
- Do NOT invent details, sentiments, emotions, or experiences that are not explicitly mentioned.
- If you don't have enough information to answer a question fully, acknowledge the gaps in your knowledge.
- Be precise about what timeframes the data covers.
- Always cite specific journal entries to support your statements.
- Use phrases like "Based on the entries I have access to..." to acknowledge your data limitations.
- Never pretend to know something you don't.
- If asked for statistics or counts, only provide exact numbers from the data.
- For emotions, only reference emotions that appear in the journal entries, with their exact intensity levels as recorded.
`;

// Main function to handle chat requests
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Starting chat-with-rag function");
    
    const { message, userId, threadId, isNewThread, threadTitle, includeDiagnostics, includeExecutionData, timeframe } = await req.json();
    
    if (!message || !userId) {
      throw new Error("Message and userId are required");
    }
    
    // Create a new thread if requested or none provided
    const chatThreadId = isNewThread || !threadId ? await createNewThread(userId, threadTitle || message.substring(0, 30)) : threadId;
    
    console.log(`Using thread: ${chatThreadId}, user: ${userId}`);
    
    // Initialize diagnostics if requested
    const diagnostics = includeDiagnostics ? {
      embeddingGenerated: false,
      embeddingError: null,
      similaritySearchComplete: false,
      searchError: null,
      contextBuilt: false,
      contextError: null,
      contextSize: 0,
      llmError: null,
      tokenCount: 0,
      executionTime: 0,
      queryType: null
    } : null;
    
    const functionExecutions = includeExecutionData ? [] : null;
    let queryAnalysis = null;
    let directComputation = false;
    
    // Start timing execution
    const startTime = Date.now();
    
    try {
      // Analyze the query to determine the appropriate search strategy
      console.log("Analyzing query:", message);
      const queryTypes = analyzeQueryTypes(message);
      queryAnalysis = queryTypes;
      
      if (diagnostics) {
        diagnostics.queryType = queryTypes;
      }
      
      console.log("Query analysis:", JSON.stringify(queryTypes));
      
      // Generate embeddings from the user query for similarity search
      let queryEmbedding = null;
      try {
        if (queryTypes.needsVectorSearch) {
          console.log("Generating query embedding for vector search");
          
          const embeddingResponse = await openai.createEmbedding({
            model: "text-embedding-ada-002",
            input: message,
          });
          
          queryEmbedding = embeddingResponse.data.data[0].embedding;
          
          if (diagnostics) {
            diagnostics.embeddingGenerated = true;
          }
        } else {
          console.log("Skipping vector search for this query type");
        }
      } catch (error) {
        console.error("Error generating embedding:", error);
        if (diagnostics) {
          diagnostics.embeddingError = error.message;
        }
        // Continue with other search methods even if embedding fails
      }
      
      // Initialize references container
      let references = [];
      
      // Choose search strategy based on query type
      if (queryTypes.isCountQuery && queryTypes.entityMentioned) {
        // Direct computation for count queries
        console.log(`Processing count query about "${queryTypes.entityMentioned}"`);
        
        const { startDate, endDate } = extractTimeRange(queryTypes.timeRange);
        const result = await countKeywordOccurrences(supabase, userId, queryTypes.entityMentioned, startDate, endDate);
        
        if (functionExecutions) {
          functionExecutions.push({
            name: "countKeywordOccurrences",
            input: { keyword: queryTypes.entityMentioned, timeRange: { startDate, endDate } },
            result
          });
        }
        
        if (result.count > 0) {
          references = result.entries.map((entry) => ({
            id: entry.id,
            date: entry.date,
            snippet: entry.snippet,
            type: 'keyword_match',
            occurrences: entry.occurrences
          }));
          
          directComputation = true;
        }
      } 
      else if (queryTypes.hasTopEmotionsPattern) {
        // Direct computation for top emotions queries
        console.log("Processing top emotions query");
        
        const { startDate, endDate } = extractTimeRange(queryTypes.timeRange);
        const result = await calculateTopEmotions(supabase, userId, startDate, endDate);
        
        if (functionExecutions) {
          functionExecutions.push({
            name: "calculateTopEmotions",
            input: { timeRange: { startDate, endDate } },
            result
          });
        }
        
        if (result.topEmotions && result.topEmotions.length > 0) {
          references = result.topEmotions.map((emotion) => ({
            emotion: emotion.emotion,
            score: emotion.score,
            frequency: emotion.frequency,
            percentageOfEntries: emotion.percentageOfEntries,
            highestOccurrence: emotion.highestOccurrence ? {
              date: emotion.highestOccurrence.date,
              snippet: emotion.highestOccurrence.content.substring(0, 150) + '...'
            } : null,
            type: 'emotion_analysis'
          }));
          
          directComputation = true;
        }
      }
      else if (queryTypes.isWhenQuestion && queryTypes.isEmotionFocused) {
        // Direct computation for "when was I most [emotion]" queries
        console.log("Processing 'when was I most [emotion]' query");
        
        // Try to extract the emotion from the query
        const emotionMatch = message.match(/when\s+(?:was|were|am|is|are)\s+(?:i|me|my|we|us|our)\s+(?:most|very|really|extremely|super)?\s+(\w+)/i);
        let emotionToFind = 'happy'; // Default
        
        if (emotionMatch && emotionMatch[1]) {
          emotionToFind = emotionMatch[1].toLowerCase();
        }
        
        console.log(`Looking for strongest occurrence of emotion: ${emotionToFind}`);
        
        const { startDate, endDate } = extractTimeRange(queryTypes.timeRange);
        const result = await findStrongestEmotionOccurrence(supabase, userId, emotionToFind, startDate, endDate);
        
        if (functionExecutions) {
          functionExecutions.push({
            name: "findStrongestEmotionOccurrence",
            input: { emotion: emotionToFind, timeRange: { startDate, endDate } },
            result
          });
        }
        
        if (result.found) {
          references = [{
            emotion: result.emotion,
            date: result.strongestOccurrence.date,
            score: result.strongestOccurrence.score,
            snippet: result.strongestOccurrence.content.substring(0, 150) + '...',
            type: 'strongest_emotion'
          }];
          
          directComputation = true;
        }
      }
      else if (queryTypes.isEntityFocused) {
        // Entity-focused query strategy
        console.log(`Processing entity query about: ${queryTypes.entityMentioned}`);
        
        const { startDate, endDate } = extractTimeRange(queryTypes.timeRange);
        
        // First, try to get sentiment analysis about this entity
        const sentimentResult = await analyzeEntitySentiment(supabase, userId, queryTypes.entityMentioned, startDate, endDate);
        
        if (functionExecutions) {
          functionExecutions.push({
            name: "analyzeEntitySentiment",
            input: { entity: queryTypes.entityMentioned, timeRange: { startDate, endDate } },
            result: sentimentResult
          });
        }
        
        if (sentimentResult.found) {
          // If we found entity sentiment information, use it
          references = [{
            entity: sentimentResult.entityName,
            mentionCount: sentimentResult.mentionCount,
            averageSentiment: sentimentResult.averageSentiment,
            sentimentDistribution: sentimentResult.sentimentDistribution,
            mostPositive: sentimentResult.mostPositiveMention ? {
              date: sentimentResult.mostPositiveMention.date,
              snippet: sentimentResult.mostPositiveMention.content.substring(0, 150) + '...',
              score: sentimentResult.mostPositiveMention.score
            } : null,
            mostNegative: sentimentResult.mostNegativeMention ? {
              date: sentimentResult.mostNegativeMention.date,
              snippet: sentimentResult.mostNegativeMention.content.substring(0, 150) + '...',
              score: sentimentResult.mostNegativeMention.score
            } : null,
            type: 'entity_sentiment'
          }];
          
          directComputation = true;
        } else {
          // Fallback to standard search
          references = await searchEntriesByEntity(supabase, userId, null, queryTypes.entityMentioned, startDate, endDate, 5);
        }
      }
      else if (queryEmbedding) {
        // Standard vector similarity search with temporal context
        console.log("Using vector similarity search");
        
        // Extract time range if specified in the query
        const { startDate, endDate } = extractTimeRange(queryTypes.timeRange);
        
        try {
          // Construct the search call
          const { data: journalEntries, error } = await supabase.rpc(
            'match_journal_entries_with_date',
            {
              query_embedding: queryEmbedding,
              match_threshold: 0.75, // Adjust threshold as needed
              match_count: 5,        // Limit to top matches
              user_id_filter: userId,
              start_date: startDate,
              end_date: endDate
            }
          );
          
          if (error) {
            console.error("Error performing vector similarity search:", error);
            if (diagnostics) {
              diagnostics.searchError = error.message;
            }
          } else {
            console.log(`Found ${journalEntries.length} entries via vector search`);
            
            if (diagnostics) {
              diagnostics.similaritySearchComplete = true;
              diagnostics.similarityScores = journalEntries.map((entry) => ({
                id: entry.id,
                score: entry.similarity
              }));
            }
            
            references = journalEntries.map(entry => ({
              id: entry.id,
              date: entry.created_at,
              snippet: entry.content.substring(0, 150) + '...',
              similarity: entry.similarity,
              type: 'vector_match'
            }));
          }
        } catch (error) {
          console.error("Exception in vector similarity search:", error);
          if (diagnostics) {
            diagnostics.searchError = error.message;
          }
        }
      }
      
      if (diagnostics) {
        diagnostics.similaritySearchComplete = true;
      }
      
      // Build context with retrieved references
      let contextText = '';
      let countContext = '';
      
      console.log(`Building context from ${references.length} references`);
      
      if (references.length > 0) {
        if (directComputation) {
          // For direct computation results, format according to the type
          if (references[0].type === 'emotion_analysis') {
            // Format top emotions results
            contextText = `Here are the emotions found in your journal entries:

`;
            references.forEach((ref, index) => {
              contextText += `${index + 1}. ${ref.emotion}: ${Math.round(ref.score * 100)}% (found in ${ref.frequency} entries, ${Math.round(ref.percentageOfEntries)}% of analyzed entries)`;
              
              if (ref.highestOccurrence) {
                contextText += `
   Example from ${new Date(ref.highestOccurrence.date).toLocaleDateString()}:
   "${ref.highestOccurrence.snippet}"`;
              }
              
              contextText += '\n\n';
            });
          } 
          else if (references[0].type === 'strongest_emotion') {
            // Format when-emotion results
            const ref = references[0];
            contextText = `The strongest instance of ${ref.emotion} was found in your entry from ${new Date(ref.date).toLocaleDateString()}, with a score of ${Math.round(ref.score)}%:

"${ref.snippet}"
`;
          } 
          else if (references[0].type === 'entity_sentiment') {
            // Format entity sentiment results
            const ref = references[0];
            contextText = `You have mentioned "${ref.entity}" in ${ref.mentionCount} journal entries. Your overall sentiment about this is ${ref.averageSentiment > 0.1 ? 'positive' : (ref.averageSentiment < -0.1 ? 'negative' : 'neutral')} (${Math.round(ref.averageSentiment * 100)}%).

Sentiment breakdown:
- Positive mentions: ${ref.sentimentDistribution.positive}
- Neutral mentions: ${ref.sentimentDistribution.neutral}
- Negative mentions: ${ref.sentimentDistribution.negative}

`;

            if (ref.mostPositive) {
              contextText += `Most positive mention (${new Date(ref.mostPositive.date).toLocaleDateString()}):
"${ref.mostPositive.snippet}"

`;
            }
            
            if (ref.mostNegative) {
              contextText += `Most negative mention (${new Date(ref.mostNegative.date).toLocaleDateString()}):
"${ref.mostNegative.snippet}"
`;
            }
          } 
          else if (references[0].type === 'keyword_match') {
            // Format count query results
            const totalOccurrences = references.reduce((sum, ref) => sum + ref.occurrences, 0);
            
            countContext = `Found ${totalOccurrences} occurrences of "${queryTypes.entityMentioned}" in ${references.length} journal entries.`;
            
            contextText = `${countContext}\n\nHere are examples:\n\n`;
            
            references.forEach((ref, index) => {
              contextText += `${index + 1}. Entry from ${new Date(ref.date).toLocaleDateString()} (${ref.occurrences} occurrences):
   "${ref.snippet}"\n\n`;
            });
          }
        } else {
          // Standard vector search results
          contextText = `Here are excerpts from your journal entries that might help answer your question:\n\n`;
          
          references.forEach((ref, index) => {
            contextText += `Entry ${index + 1} (${new Date(ref.date).toLocaleDateString()}):
"${ref.snippet}"\n\n`;
          });
        }
      } else {
        contextText = "I don't have enough information in your journal entries to answer that question confidently. Could you provide more details or ask something else?";
      }
      
      if (diagnostics) {
        diagnostics.contextBuilt = true;
        diagnostics.contextSize = contextText.length;
      }
      
      // Compose the complete prompt for the chat completion
      const messages = [
        {
          role: "system",
          content: `You are a helpful, reflective AI journaling assistant named Roha. You analyze the user's journal entries to provide insights and answer their questions.

${ANTI_HALLUCINATION_INSTRUCTIONS}

When responding to the user:
1. Be empathetic, thoughtful, and supportive - like a caring friend.
2. When discussing emotions or patterns, refer specifically to the journal entries provided.
3. Focus on being accurate rather than comprehensive - it's better to acknowledge limitations than to guess.
4. For queries about emotions, only mention emotions that actually appear in the entries.
5. Format your responses with clear structure - use bullet points, paragraphs, and examples.
6. Always sound conversational and personal, not clinical or detached.
7. Remember you have access to a limited window of the user's journal - don't assume you know everything about them.`
        },
        {
          role: "user",
          content: `My question is: ${message}\n\nBased on my journal entries, please answer insightfully.\n\nHere's the relevant information from my journal:\n\n${contextText}`
        }
      ];
      
      // For direct computations with countable results, we need to ensure accuracy
      if (directComputation && countContext) {
        messages[0].content += `\n\nThis is a factual query with a precise numerical answer. Make sure to state the exact count in your response: ${countContext}`;
      }
      
      console.log("Sending request to OpenAI with messages:", JSON.stringify(messages.map(m => ({ role: m.role, content: m.content.substring(0, 50) + '...' }))));
      
      const chatCompletion = await openai.createChatCompletion({
        model: "gpt-4o-mini", // You can change this to gpt-4o if you need more powerful responses
        messages: messages,
        temperature: 0.2, // Low temperature for more factual responses
        max_tokens: 1000,
      });
      
      const responseText = chatCompletion.data.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";
      
      if (diagnostics) {
        diagnostics.tokenCount = chatCompletion.data.usage.total_tokens;
        diagnostics.executionTime = Date.now() - startTime;
      }
      
      // Store the message in the chat thread
      await storeMessage(chatThreadId, message, 'user');
      await storeMessage(chatThreadId, responseText, 'assistant', references);
      
      return new Response(
        JSON.stringify({
          response: responseText,
          references: references,
          threadId: chatThreadId,
          queryAnalysis: queryAnalysis,
          diagnostics: diagnostics,
          functionExecutions: functionExecutions
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      console.error("Error in chat processing:", error);
      if (diagnostics) {
        diagnostics.llmError = error.message;
        diagnostics.executionTime = Date.now() - startTime;
      }
      
      return new Response(
        JSON.stringify({ 
          error: error.message,
          response: "I'm sorry, I couldn't process your request at this time. Please try again later.",
          threadId: chatThreadId,
          diagnostics: diagnostics
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Uncaught error in chat-with-rag function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        response: "An unexpected error occurred. Please try again later."
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to extract time range from query analysis
function extractTimeRange(timeRange: any) {
  let startDate = null;
  let endDate = null;
  
  if (timeRange && timeRange.type) {
    if (timeRange.startDate) {
      startDate = timeRange.startDate;
    }
    
    if (timeRange.endDate) {
      endDate = timeRange.endDate;
    }
  }
  
  return { startDate, endDate };
}

// Create a new chat thread
async function createNewThread(userId: string, title: string) {
  try {
    const threadId = uuidv4();
    
    const { error } = await supabase
      .from('chat_threads')
      .insert({
        id: threadId,
        user_id: userId,
        title: title || "New Conversation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (error) {
      console.error("Error creating thread:", error);
      throw error;
    }
    
    return threadId;
  } catch (error) {
    console.error("Exception creating thread:", error);
    throw error;
  }
}

// Store a chat message in the database
async function storeMessage(threadId: string, content: string, sender: 'user' | 'assistant', references: any[] = []) {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: content,
        sender: sender,
        reference_entries: sender === 'assistant' ? references : null,
        created_at: new Date().toISOString()
      });
      
    if (error) {
      console.error("Error storing message:", error);
      throw error;
    }
    
    // Update thread's last activity timestamp
    await supabase
      .from('chat_threads')
      .update({ 
        updated_at: new Date().toISOString(),
        last_message: content.substring(0, 100) + (content.length > 100 ? '...' : '')
      })
      .eq('id', threadId);
      
    return true;
  } catch (error) {
    console.error("Exception storing message:", error);
    throw error;
  }
}
