import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
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
    
    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      throw new Error('OpenAI API key is not configured in environment variables');
    }
    
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, queryTypes, threadId = null, isNewThread = false, includeDiagnostics = false } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    if (!openAIApiKey) {
      console.error('OpenAI API key is missing or empty');
      throw new Error('OpenAI API key is not configured in environment variables');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    
    // Check if this is a quantitative query about emotions
    const emotionQueryAnalysis = detectEmotionQuantitativeQuery(message);
    
    // If we have a quantitative query about emotions, handle it directly
    if (queryTypes?.isQuantitative && emotionQueryAnalysis.isQuantitativeEmotionQuery) {
      console.log("Detected quantitative emotion query:", emotionQueryAnalysis);
      
      if (emotionQueryAnalysis.isTopEmotionsQuery) {
        // Handle request for top emotions
        const emotionStats = await calculateTopEmotions(
          userId,
          emotionQueryAnalysis.timeRange,
          emotionQueryAnalysis.topCount
        );
        
        console.log("Calculated top emotions:", emotionStats);
        
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
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Handle request for specific emotion score
        const emotionStats = await calculateAverageEmotionScore(
          userId, 
          emotionQueryAnalysis.emotionType, 
          emotionQueryAnalysis.timeRange
        );
        
        console.log("Calculated emotion stats:", emotionStats);
        
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
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const queryEmbedding = await generateEmbedding(message);
    
    // Search for relevant journal entries using vector similarity
    console.log("Searching for relevant context using match_journal_entries function...");
    const { data: similarEntries, error: searchError } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        user_id_filter: userId
      }
    );
    
    if (searchError) {
      console.error("Error searching for similar entries:", searchError);
      console.error("Search error details:", JSON.stringify(searchError));
    }
    
    // Create RAG context from relevant entries
    let journalContext = "";
    if (similarEntries && similarEntries.length > 0) {
      console.log("Found similar entries:", similarEntries.length);
      
      // Fetch full entries for context
      const entryIds = similarEntries.map(entry => entry.id);
      const { data: entries, error: entriesError } = await supabase
        .from('Journal Entries')
        .select('refined text, created_at, emotions')
        .in('id', entryIds);
      
      if (entriesError) {
        console.error("Error retrieving journal entries:", entriesError);
      } else if (entries && entries.length > 0) {
        console.log("Retrieved full entries:", entries.length);
        // Format entries as context with emotions data
        journalContext = "Here are some of your journal entries that might be relevant to your question:\n\n" + 
          entries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const emotionsText = formatEmotions(entry.emotions);
            return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
          }).join('\n\n') + "\n\n";
      }
    } else {
      console.log("No similar entries found, falling back to recent entries");
      // Fallback to recent entries if no similar ones found
      const { data: recentEntries, error: recentError } = await supabase
        .from('Journal Entries')
        .select('refined text, created_at, emotions')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (recentError) {
        console.error("Error retrieving recent entries:", recentError);
      } else if (recentEntries && recentEntries.length > 0) {
        console.log("Retrieved recent entries:", recentEntries.length);
        journalContext = "Here are some of your recent journal entries:\n\n" + 
          recentEntries.map((entry, index) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const emotionsText = formatEmotions(entry.emotions);
            return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
          }).join('\n\n') + "\n\n";
      }
    }
    
    // Get user's first name for personalized response
    let firstName = "";
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();
        
      if (!profileError && profileData?.full_name) {
        firstName = profileData.full_name.split(' ')[0];
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
    
    // Prepare system prompt with RAG context
    const systemPrompt = `You are Roha, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}
Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic. 
${firstName ? `Always address the user by their first name (${firstName}) in your responses.` : ""}`;

    console.log("Sending to GPT with RAG context...");
    
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
      
      return new Response(
        JSON.stringify({ response: aiResponse }),
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
    console.error("Error in chat-rag function:", error);
    
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
