
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

// Track function execution for diagnostics
interface FunctionExecution {
  name: string;
  params?: Record<string, any>;
  result?: any;
  executionTime?: number;
  success: boolean;
}

// Generate embeddings using OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  const startTime = Date.now();
  let functionResult: FunctionExecution = {
    name: 'generateEmbedding',
    params: { text: text.substring(0, 50) + "..." },
    success: false
  };

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
      functionResult.executionTime = Date.now() - startTime;
      functionResult.result = { error };
      throw new Error('Failed to generate embedding');
    }

    const result = await response.json();
    functionResult.success = true;
    functionResult.executionTime = Date.now() - startTime;
    functionResult.result = { 
      model: result.model,
      embeddingLength: result.data[0].embedding.length
    };
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    functionResult.success = false;
    if (!functionResult.executionTime) functionResult.executionTime = Date.now() - startTime;
    functionResult.result = { error: error instanceof Error ? error.message : String(error) };
    throw error;
  } finally {
    // Return function execution data in diagnostics
    return functionResult;
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

// Calculate average emotion score for quantitative analysis
async function calculateAverageEmotionScore(userId: string, emotionType: string = 'happiness', timeRange: string = 'month') {
  try {
    let startDate = new Date();
    
    // Set time range
    if (timeRange === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (timeRange === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    // Query entries within the time range
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('emotions, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching entries for emotion calculation:", error);
      return { averageScore: null, entryCount: 0, error: error.message };
    }
    
    if (!entries || entries.length === 0) {
      return { averageScore: null, entryCount: 0, error: 'No entries found' };
    }
    
    // Calculate average emotion score
    let totalScore = 0;
    let validEntries = 0;
    
    entries.forEach(entry => {
      if (entry.emotions && entry.emotions[emotionType]) {
        totalScore += parseFloat(entry.emotions[emotionType]);
        validEntries++;
      }
    });
    
    const averageScore = validEntries > 0 ? (totalScore / validEntries) * 100 : null;
    
    return { 
      averageScore: averageScore ? Math.round(averageScore) : null, 
      entryCount: entries.length,
      validEntryCount: validEntries
    };
  } catch (error) {
    console.error("Error calculating average emotion score:", error);
    return { averageScore: null, entryCount: 0, error: error.message };
  }
}

// Calculate top emotions over a time period
async function calculateTopEmotions(userId: string, timeRange: string = 'month', limit: number = 3) {
  try {
    let startDate = new Date();
    
    // Set time range
    if (timeRange === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (timeRange === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else if (timeRange === 'day' || timeRange === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
    }
    
    // Query entries within the time range
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('emotions, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching entries for top emotions calculation:", error);
      return { topEmotions: [], entryCount: 0, error: error.message };
    }
    
    if (!entries || entries.length === 0) {
      return { topEmotions: [], entryCount: 0, error: 'No entries found' };
    }
    
    // Aggregate emotions across all entries
    const emotionScores: Record<string, {total: number, count: number}> = {};
    
    entries.forEach(entry => {
      if (entry.emotions) {
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          if (!emotionScores[emotion]) {
            emotionScores[emotion] = { total: 0, count: 0 };
          }
          emotionScores[emotion].total += parseFloat(score as string);
          emotionScores[emotion].count += 1;
        });
      }
    });
    
    // Calculate average for each emotion and sort
    const averagedEmotions = Object.entries(emotionScores)
      .map(([emotion, data]) => ({
        emotion,
        score: data.total / data.count,
        frequency: data.count
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return { 
      topEmotions: averagedEmotions, 
      entryCount: entries.length
    };
  } catch (error) {
    console.error("Error calculating top emotions:", error);
    return { topEmotions: [], entryCount: 0, error: error.message };
  }
}

// Detect quantitative queries about emotions
function detectEmotionQuantitativeQuery(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Match patterns like "how happy am I", "rate my happiness", etc.
  const emotionPatterns = {
    happiness: /how (happy|content|satisfied|joyful|cheerful)|(happiness|joy|satisfaction) (score|rating|level)/i,
    sadness: /how (sad|unhappy|depressed|down|blue)|(sadness|depression|unhappiness) (score|rating|level)/i,
    anger: /how (angry|mad|frustrated|irritated)|(anger|frustration|irritation) (score|rating|level)/i,
    anxiety: /how (anxious|worried|nervous|stressed)|(anxiety|stress|worry) (score|rating|level)/i,
    fear: /how (afraid|scared|fearful|frightened)|(fear) (score|rating|level)/i
  };
  
  // Check for numeric rating requests
  const ratingPattern = /(rate|score|percentage|level|out of \d+|scale|quantify)/i;
  const hasRatingRequest = ratingPattern.test(lowerMessage);
  
  // Check for time periods
  const timePatterns = {
    week: /(this|last|past) week|7 days/i,
    month: /(this|last|past) month|30 days/i,
    year: /(this|last|past) year|365 days/i
  };
  
  // Check for top emotions request
  const topEmotionsPattern = /top (\d+|three|3|five|5) emotions/i;
  const isTopEmotionsQuery = topEmotionsPattern.test(lowerMessage);
  
  // Extract number of emotions requested if applicable
  let topCount = 3; // Default
  if (isTopEmotionsQuery) {
    const match = lowerMessage.match(/top (\d+|three|five)/i);
    if (match && match[1]) {
      if (match[1] === "three") topCount = 3;
      else if (match[1] === "five") topCount = 5;
      else topCount = parseInt(match[1], 10);
    }
  }
  
  // Determine emotion type and time range
  let emotionType = null;
  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    if (pattern.test(lowerMessage)) {
      emotionType = emotion;
      break;
    }
  }
  
  let timeRange = 'month'; // Default
  for (const [time, pattern] of Object.entries(timePatterns)) {
    if (pattern.test(lowerMessage)) {
      timeRange = time;
      break;
    }
  }
  
  return {
    isQuantitativeEmotionQuery: emotionType !== null || hasRatingRequest || isTopEmotionsQuery,
    emotionType: emotionType || 'happiness', // Default to happiness if no specific emotion
    timeRange,
    isTopEmotionsQuery,
    topCount
  };
}

// Update the function that searches journal entries using vector similarity
async function searchJournalEntriesWithVector(
  userId: string, 
  queryEmbedding: any[],
  timeRange?: { startDate?: Date; endDate?: Date }
) {
  try {
    console.log(`Searching journal entries with vector for userId: ${userId}`);
    
    // Use the fixed function we created
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
    console.error('Error searching journal entries with vector:', error);
    throw error;
  }
}

// Detect if query appears to be a direct date query
function isDirectDateQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Check for direct date-related queries
  return (
    lowerQuery.includes('what is the current week') ||
    lowerQuery.includes('what are the dates for this week') ||
    lowerQuery.includes('current week dates') ||
    lowerQuery.includes('this week dates') ||
    lowerQuery.includes('last week dates') ||
    lowerQuery.includes('previous week dates') ||
    lowerQuery.includes('what are the dates for last week')
  );
}

// Detect if query appears to be a journal analysis query
function isJournalAnalysisQuery(message: string): boolean {
  const lowerQuery = message.toLowerCase();
  
  // Check for journal analysis related queries
  return (
    lowerQuery.includes('analyze my journal') ||
    lowerQuery.includes('journal analysis') ||
    lowerQuery.includes('journal entries') ||
    lowerQuery.includes('my entries') ||
    lowerQuery.includes('what have i written about') ||
    lowerQuery.includes('what did i write about')
  );
}

// Handle the request to chat with RAG (Retrieval-Augmented Generation)
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // For tracking RAG process steps
  const diagnosticSteps: {name: string, status: string, details?: string}[] = [];
  const functionExecutions: FunctionExecution[] = [];
  let similarityScores: {id: number, score: number}[] = [];
  
  try {
    const { message, userId, queryTypes, threadId = null, isNewThread = false, includeDiagnostics = false } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    diagnosticSteps.push({
      name: "Initialize Request", 
      status: "success",
      details: `Processing message: "${message.substring(0, 30)}..." for user: ${userId}`
    });
    
    // Check if OpenAI API key is valid
    if (!openAIApiKey || openAIApiKey === '') {
      diagnosticSteps.push({
        name: "Check API configuration", 
        status: "error",
        details: "OpenAI API key is missing or invalid"
      });
      throw new Error("OpenAI API key is not configured");
    }
    
    // Check if this is a quantitative query about emotions
    const emotionQueryAnalysis = detectEmotionQuantitativeQuery(message);
    diagnosticSteps.push({
      name: "Analyze Query Type", 
      status: "success",
      details: `Query type analysis complete: ${JSON.stringify(emotionQueryAnalysis)}`
    });
    
    // If we have a quantitative query about emotions, handle it directly
    if (queryTypes?.isQuantitative && emotionQueryAnalysis.isQuantitativeEmotionQuery) {
      console.log("Detected quantitative emotion query:", emotionQueryAnalysis);
      diagnosticSteps.push({
        name: "Quantitative Emotion Query", 
        status: "success",
        details: `Detected quantitative emotion query: ${JSON.stringify(emotionQueryAnalysis)}`
      });
      
      if (emotionQueryAnalysis.isTopEmotionsQuery) {
        // Handle request for top emotions
        try {
          diagnosticSteps.push({
            name: "Calculate Top Emotions", 
            status: "loading",
            details: `Timeframe: ${emotionQueryAnalysis.timeRange}, Count: ${emotionQueryAnalysis.topCount}`
          });
          
          const startTime = Date.now();
          const emotionStats = await calculateTopEmotions(
            userId,
            emotionQueryAnalysis.timeRange,
            emotionQueryAnalysis.topCount
          );
          
          // Track function execution for diagnostics
          functionExecutions.push({
            name: "calculateTopEmotions",
            params: {
              userId: "***",
              timeRange: emotionQueryAnalysis.timeRange,
              topCount: emotionQueryAnalysis.topCount
            },
            result: emotionStats,
            executionTime: Date.now() - startTime,
            success: !emotionStats.error
          });
          
          console.log("Calculated top emotions:", emotionStats);
          
          if (emotionStats.error) {
            diagnosticSteps.push({
              name: "Calculate Top Emotions", 
              status: "error",
              details: emotionStats.error
            });
          } else {
            diagnosticSteps.push({
              name: "Calculate Top Emotions", 
              status: "success",
              details: `Found ${emotionStats.topEmotions.length} emotions from ${emotionStats.entryCount} entries`
            });
          }
          
          // If we have valid emotion data, provide a direct answer
          if (emotionStats.topEmotions.length > 0) {
            const emotionsFormatted = emotionStats.topEmotions.map((emotion, index) => {
              return `${index + 1}. ${emotion.emotion.charAt(0).toUpperCase() + emotion.emotion.slice(1)} (${Math.round(emotion.score * 100)}%)`;
            }).join(', ');
            
            let directResponse = `Based on your journal entries from the past ${emotionQueryAnalysis.timeRange}, `;
            directResponse += `your top ${emotionStats.topEmotions.length} emotions were: ${emotionsFormatted}. `;
            directResponse += `This analysis is based on ${emotionStats.entryCount} journal entries. `;
            directResponse += `Would you like me to provide more insights about any of these emotions?`;
            
            return new Response(
              JSON.stringify({ 
                response: directResponse,
                analysis: {
                  type: 'top_emotions',
                  data: emotionStats
                },
                diagnostics: includeDiagnostics ? {
                  steps: diagnosticSteps,
                  functionCalls: functionExecutions,
                  similarityScores
                } : undefined
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (error) {
          console.error("Error calculating top emotions:", error);
          diagnosticSteps.push({
            name: "Calculate Top Emotions", 
            status: "error",
            details: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        // Handle request for specific emotion score
        try {
          diagnosticSteps.push({
            name: "Calculate Emotion Score", 
            status: "loading",
            details: `Emotion: ${emotionQueryAnalysis.emotionType}, Timeframe: ${emotionQueryAnalysis.timeRange}`
          });
          
          const startTime = Date.now();
          const emotionStats = await calculateAverageEmotionScore(
            userId, 
            emotionQueryAnalysis.emotionType, 
            emotionQueryAnalysis.timeRange
          );
          
          functionExecutions.push({
            name: "calculateAverageEmotionScore",
            params: {
              userId: "***",
              emotionType: emotionQueryAnalysis.emotionType,
              timeRange: emotionQueryAnalysis.timeRange
            },
            result: emotionStats,
            executionTime: Date.now() - startTime,
            success: emotionStats.averageScore !== null
          });
          
          console.log("Calculated emotion stats:", emotionStats);
          
          if (emotionStats.error) {
            diagnosticSteps.push({
              name: "Calculate Emotion Score", 
              status: "error",
              details: emotionStats.error
            });
          } else {
            diagnosticSteps.push({
              name: "Calculate Emotion Score", 
              status: "success",
              details: `Score: ${emotionStats.averageScore}, Entries: ${emotionStats.entryCount}`
            });
          }
          
          // If we have valid emotion data, provide a direct answer
          if (emotionStats.averageScore !== null) {
            let directResponse = `Based on your journal entries from the past ${emotionQueryAnalysis.timeRange}, `;
            directResponse += `your average ${emotionQueryAnalysis.emotionType} score is ${emotionStats.averageScore} out of 100. `;
            
            if (emotionStats.validEntryCount < emotionStats.entryCount) {
              directResponse += `This is calculated from ${emotionStats.validEntryCount} entries that had ${emotionQueryAnalysis.emotionType} data out of ${emotionStats.entryCount} total entries in this period. `;
            }
            
            directResponse += `Would you like me to analyze this further or suggest ways to improve your ${emotionQueryAnalysis.emotionType}?`;
            
            return new Response(
              JSON.stringify({ 
                response: directResponse,
                analysis: {
                  type: 'quantitative_emotion',
                  data: emotionStats
                },
                diagnostics: includeDiagnostics ? {
                  steps: diagnosticSteps,
                  functionCalls: functionExecutions,
                  similarityScores
                } : undefined
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (error) {
          console.error("Error calculating emotion score:", error);
          diagnosticSteps.push({
            name: "Calculate Emotion Score", 
            status: "error",
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // If we couldn't handle the quantitative query as expected, fall back to the general approach
      console.log("Couldn't process quantitative query with direct method, falling back to general approach");
      diagnosticSteps.push({
        name: "Direct Query Processing", 
        status: "error",
        details: "Could not process quantitative query directly, falling back to general approach"
      });
    }
    
    // Generate embedding for the user query
    diagnosticSteps.push({
      name: "Generate embedding for query", 
      status: "loading"
    });
    
    let embeddingExecution: FunctionExecution;
    let queryEmbedding: number[];
    
    try {
      const result = await generateEmbedding(message);
      if (Array.isArray(result)) {
        queryEmbedding = result;
        diagnosticSteps.push({
          name: "Generate embedding for query", 
          status: "success",
          details: `Generated embedding with ${queryEmbedding.length} dimensions`
        });
      } else {
        // This is the function execution data
        embeddingExecution = result as any;
        functionExecutions.push(embeddingExecution);
        if (!embeddingExecution.success) {
          diagnosticSteps.push({
            name: "Generate embedding for query", 
            status: "error",
            details: embeddingExecution.result?.error || "Unknown error"
          });
          throw new Error("Failed to generate embedding: " + embeddingExecution.result?.error);
        }
      }
    } catch (error) {
      console.error("Error generating embedding:", error);
      diagnosticSteps.push({
        name: "Generate embedding for query", 
        status: "error",
        details: error instanceof Error ? error.message : String(error)
      });
      
      // Respond with the error but in a 200 status to avoid CORS issues
      return new Response(
        JSON.stringify({
          response: "I'm having trouble understanding your request right now. There was an error processing your query's semantic meaning.",
          error: error instanceof Error ? error.message : String(error),
          diagnostics: includeDiagnostics ? {
            steps: diagnosticSteps,
            functionCalls: functionExecutions,
            similarityScores
          } : undefined
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Search for relevant journal entries using vector similarity
    diagnosticSteps.push({
      name: "Search for relevant entries", 
      status: "loading",
      details: "Using vector similarity search"
    });
    
    const startSearchTime = Date.now();
    const { data: similarEntries, error: searchError } = await searchJournalEntriesWithVector(
      userId,
      queryEmbedding
    );
    
    const searchExecution: FunctionExecution = {
      name: "match_journal_entries_fixed",
      params: {
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userId
      },
      result: searchError ? { error: searchError.message } : { count: similarEntries?.length || 0 },
      executionTime: Date.now() - startSearchTime,
      success: !searchError
    };
    functionExecutions.push(searchExecution);
    
    if (searchError) {
      console.error("Error searching for similar entries:", searchError);
      console.error("Search error details:", JSON.stringify(searchError));
      diagnosticSteps.push({
        name: "Search for relevant entries", 
        status: "error",
        details: searchError.message
      });
    } else if (similarEntries && similarEntries.length > 0) {
      console.log("Found similar entries:", similarEntries.length);
      diagnosticSteps.push({
        name: "Search for relevant entries", 
        status: "success",
        details: `Found ${similarEntries.length} relevant entries`
      });
      
      // Track similarity scores for diagnostics
      similarityScores = similarEntries.map(entry => ({
        id: entry.id,
        score: entry.similarity
      }));
    } else {
      console.log("No similar entries found");
      diagnosticSteps.push({
        name: "Search for relevant entries", 
        status: "warning",
        details: "No similar entries found with vector search"
      });
    }
    
    // Create RAG context from relevant entries
    let journalContext = "";
    let contextEntries = [];
    
    if (similarEntries && similarEntries.length > 0) {
      diagnosticSteps.push({
        name: "Fetch full entries", 
        status: "loading"
      });
      
      // Fetch full entries for context
      const startFetchTime = Date.now();
      const entryIds = similarEntries.map(entry => entry.id);
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('"refined text", created_at, emotions, master_themes')
        .in('id', entryIds);
      
      const fetchExecution: FunctionExecution = {
        name: "fetch_journal_entries",
        params: { ids: entryIds },
        result: entriesError ? { error: entriesError.message } : { count: entries?.length || 0 },
        executionTime: Date.now() - startFetchTime,
        success: !entriesError
      };
      functionExecutions.push(fetchExecution);
      
      if (entriesError) {
        console.error("Error retrieving journal entries:", entriesError);
        diagnosticSteps.push({
          name: "Fetch full entries", 
          status: "error",
          details: entriesError.message
        });
      } else if (entries && entries.length > 0) {
        console.log("Retrieved full entries:", entries.length);
        diagnosticSteps.push({
          name: "Fetch full entries", 
          status: "success",
          details: `Retrieved ${entries.length} full entries`
        });
        
        // Format entries as context with emotions data
        contextEntries = entries.map((entry, index) => {
          const entryWithSimilarity = similarEntries.find(e => e.id === entryIds[index]);
          const similarity = entryWithSimilarity ? entryWithSimilarity.similarity : null;
          
          return {
            id: entryIds[index],
            date: entry.created_at,
            snippet: entry["refined text"],
            emotions: entry.emotions,
            themes: entry.master_themes,
            similarity,
            type: 'journal entry'
          };
        });
        
        journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
          entries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const emotionsText = formatEmotions(entry.emotions);
            return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
          }).join('\n\n') + "\n\n";
          
        diagnosticSteps.push({
          name: "Build context from entries", 
          status: "success",
          details: `Built context with ${entries.length} entries`
        });
      }
    } else {
      console.log("No similar entries found, falling back to recent entries");
      diagnosticSteps.push({
        name: "Fallback to recent entries", 
        status: "loading",
        details: "No similar entries found, using recent entries instead"
      });
      
      // Fallback to recent entries if no similar ones found
      const startRecentTime = Date.now();
      const { data: recentEntries, error: recentError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", created_at, emotions, master_themes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
      
      const recentExecution: FunctionExecution = {
        name: "fetch_recent_journal_entries",
        params: { user_id: "***", limit: 3 },
        result: recentError ? { error: recentError.message } : { count: recentEntries?.length || 0 },
        executionTime: Date.now() - startRecentTime,
        success: !recentError
      };
      functionExecutions.push(recentExecution);
      
      if (recentError) {
        console.error("Error retrieving recent entries:", recentError);
        diagnosticSteps.push({
          name: "Fallback to recent entries", 
          status: "error",
          details: recentError.message
        });
      } else if (recentEntries && recentEntries.length > 0) {
        console.log("Retrieved recent entries:", recentEntries.length);
        diagnosticSteps.push({
          name: "Fallback to recent entries", 
          status: "success",
          details: `Retrieved ${recentEntries.length} recent entries`
        });
        
        contextEntries = recentEntries.map(entry => ({
          id: entry.id,
          date: entry.created_at,
          snippet: entry["refined text"],
          emotions: entry.emotions,
          themes: entry.master_themes,
          similarity: null,
          type: 'recent entry'
        }));
        
        journalContext = "Here are some of your recent journal entries:\n\n" + 
          recentEntries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const emotionsText = formatEmotions(entry.emotions);
            return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
          }).join('\n\n') + "\n\n";
          
        diagnosticSteps.push({
          name: "Build context from entries", 
          status: "success",
          details: `Built context with ${recentEntries.length} recent entries`
        });
      } else {
        console.log("No recent entries found either, proceeding with empty context");
        diagnosticSteps.push({
          name: "Build context from entries", 
          status: "warning",
          details: "No entries found, proceeding with empty context"
        });
      }
    }
    
    // Get user's first name for personalized response
    let firstName = "";
    try {
      diagnosticSteps.push({
        name: "Fetch user profile", 
        status: "loading"
      });
      
      const startProfileTime = Date.now();
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
        
      const profileExecution: FunctionExecution = {
        name: "fetch_user_profile",
        params: { user_id: "***" },
        result: profileError ? { error: profileError.message } : { full_name: profileData?.full_name },
        executionTime: Date.now() - startProfileTime,
        success: !profileError && !!profileData
      };
      functionExecutions.push(profileExecution);
        
      if (profileError) {
        diagnosticSteps.push({
          name: "Fetch user profile", 
          status: "error",
          details: profileError.message
        });
      } else if (profileData?.full_name) {
        firstName = profileData.full_name.split(' ')[0];
        diagnosticSteps.push({
          name: "Fetch user profile", 
          status: "success",
          details: `User: ${firstName}`
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      diagnosticSteps.push({
        name: "Fetch user profile", 
        status: "error",
        details: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are Roha, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}
Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
${firstName ? `Always address the user by their first name (${firstName}) in your responses.` : ""}

RESPONSE GUIDELINES:
- Be extremely concise and to the point
- Use bullet points wherever possible
- Don't make assumptions about information not provided
- Keep your tone warm but direct
- Focus on being helpful rather than diagnostic
- Avoid lengthy explanations unless specifically requested
`;

    console.log("Sending to GPT with RAG context...");
    diagnosticSteps.push({
      name: "Generate AI response", 
      status: "loading",
      details: "Sending query with context to OpenAI"
    });
    
    try {
      // Send to GPT with RAG context
      const startGptTime = Date.now();
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
        
        const gptExecution: FunctionExecution = {
          name: "openai_chat_completion",
          params: { model: 'gpt-4o-mini' },
          result: { error: errorText },
          executionTime: Date.now() - startGptTime,
          success: false
        };
        functionExecutions.push(gptExecution);
        
        diagnosticSteps.push({
          name: "Generate AI response", 
          status: "error",
          details: `OpenAI API error: ${errorText}`
        });
        
        throw new Error(`OpenAI API error: ${errorText}`);
      }
      
      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      const gptExecution: FunctionExecution = {
        name: "openai_chat_completion",
        params: { model: 'gpt-4o-mini' },
        result: { 
          responseLength: aiResponse.length,
          firstChars: aiResponse.substring(0, 50) + "..."
        },
        executionTime: Date.now() - startGptTime,
        success: true
      };
      functionExecutions.push(gptExecution);
      
      diagnosticSteps.push({
        name: "Generate AI response", 
        status: "success",
        details: `Generated response with ${aiResponse.length} characters`
      });
      
      // Save the message to the thread if it's not null
      if (threadId !== null) {
        diagnosticSteps.push({
          name: "Save conversation", 
          status: "loading"
        });
        
        try {
          // Get generated references to context entries
          const references = contextEntries.length > 0 ? contextEntries.map(entry => ({
            id: entry.id,
            date: entry.date,
            snippet: entry.snippet?.substring(0, 150) + (entry.snippet?.length > 150 ? "..." : ""),
            emotions: entry.emotions,
            similarity: entry.similarity
          })) : null;
          
          // Store both user message and AI response if this is a new or ongoing thread
          if (isNewThread) {
            const saveUserStartTime = Date.now();
            // Save user message
            const { error: userMsgError } = await supabase
              .from('chat_messages')
              .insert({
                thread_id: threadId,
                content: message,
                sender: 'user'
              });
              
            const userSaveExecution: FunctionExecution = {
              name: "save_user_message",
              params: { thread_id: threadId },
              result: userMsgError ? { error: userMsgError.message } : { success: true },
              executionTime: Date.now() - saveUserStartTime,
              success: !userMsgError
            };
            functionExecutions.push(userSaveExecution);
              
            if (userMsgError) {
              console.error("Error saving user message:", userMsgError);
              diagnosticSteps.push({
                name: "Save user message", 
                status: "error",
                details: userMsgError.message
              });
            } else {
              diagnosticSteps.push({
                name: "Save user message", 
                status: "success"
              });
            }
          }
          
          // Save AI response
          const saveAiStartTime = Date.now();
          const { error: aiMsgError } = await supabase
            .from('chat_messages')
            .insert({
              thread_id: threadId,
              content: aiResponse,
              sender: 'assistant',
              reference_entries: references,
              analysis_data: {
                queryTypeDetection: emotionQueryAnalysis,
                diagnosticSteps: diagnosticSteps
              },
              has_numeric_result: emotionQueryAnalysis.isQuantitativeEmotionQuery
            });
            
          const aiSaveExecution: FunctionExecution = {
            name: "save_assistant_message",
            params: { thread_id: threadId },
            result: aiMsgError ? { error: aiMsgError.message } : { success: true },
            executionTime: Date.now() - saveAiStartTime,
            success: !aiMsgError
          };
          functionExecutions.push(aiSaveExecution);
            
          if (aiMsgError) {
            console.error("Error saving AI response:", aiMsgError);
            diagnosticSteps.push({
              name: "Save assistant response", 
              status: "error",
              details: aiMsgError.message
            });
          } else {
            diagnosticSteps.push({
              name: "Save assistant response", 
              status: "success"
            });
          }
          
          // Update thread with latest message
          const updateThreadStartTime = Date.now();
          const { error: threadUpdateError } = await supabase
            .from('chat_threads')
            .update({ 
              last_message: aiResponse.substring(0, 100) + (aiResponse.length > 100 ? "..." : ""),
              updated_at: new Date().toISOString()
            })
            .eq('id', threadId);
            
          const threadUpdateExecution: FunctionExecution = {
            name: "update_thread",
            params: { thread_id: threadId },
            result: threadUpdateError ? { error: threadUpdateError.message } : { success: true },
            executionTime: Date.now() - updateThreadStartTime,
            success: !threadUpdateError
          };
          functionExecutions.push(threadUpdateExecution);
            
          if (threadUpdateError) {
            console.error("Error updating thread:", threadUpdateError);
            diagnosticSteps.push({
              name: "Update thread", 
              status: "error",
              details: threadUpdateError.message
            });
          } else {
            diagnosticSteps.push({
              name: "Update thread", 
              status: "success"
            });
          }
        } catch (saveError) {
          console.error("Error saving conversation:", saveError);
          diagnosticSteps.push({
            name: "Save conversation", 
            status: "error",
            details: saveError instanceof Error ? saveError.message : String(saveError)
          });
        }
      }
      
      // Return the final response
      return new Response(
        JSON.stringify({ 
          response: aiResponse,
          references: contextEntries.map(entry => ({
            id: entry.id,
            date: entry.date,
            snippet: entry.snippet?.substring(0, 150) + (entry.snippet?.length > 150 ? "..." : ""),
            emotions: entry.emotions,
            themes: entry.themes,
            similarity: entry.similarity,
            type: entry.type
          })),
          diagnostics: includeDiagnostics ? {
            steps: diagnosticSteps,
            functionCalls: functionExecutions,
            similarityScores
          } : undefined
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error("Error in GPT response generation:", error);
      diagnosticSteps.push({
        name: "Generate AI response", 
        status: "error",
        details: error instanceof Error ? error.message : String(error)
      });
      
      return new Response(
        JSON.stringify({
          response: "I'm having trouble generating a response right now. There was an error connecting to the AI service. Please try again later.",
          error: error instanceof Error ? error.message : String(error),
          diagnostics: includeDiagnostics ? {
            steps: diagnosticSteps,
            functionCalls: functionExecutions,
            similarityScores
          } : undefined
        }),
        { 
          status: 200, // Use 200 even for errors to avoid CORS issues
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error("Unhandled error in chat-rag function:", error);
    
    return new Response(
      JSON.stringify({
        response: "An unexpected error occurred. Please try again later.",
        error: error instanceof Error ? error.message : String(error),
        diagnostics: {
          steps: diagnosticSteps,
          functionCalls: functionExecutions,
          similarityScores
        }
      }),
      { 
        status: 200, // Use 200 even for errors to avoid CORS issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
