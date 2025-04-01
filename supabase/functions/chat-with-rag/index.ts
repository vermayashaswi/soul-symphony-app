
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

// Analyze if query is about top emotions
function isTopEmotionsQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const emotionPatterns = [
    /top (\d+|three|3|five|5) emotions/i,
    /main emotions/i,
    /primary emotions/i,
    /dominant emotions/i,
    /what emotions/i,
    /how (did|do) i feel/i
  ];
  
  return emotionPatterns.some(pattern => pattern.test(lowerMessage));
}

// Analyze if query is about why certain emotions were experienced
function isEmotionWhyQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (lowerMessage.includes('why') || lowerMessage.includes('reason')) && 
         isTopEmotionsQuery(message);
}

// Extract time period from query
function extractTimePeriod(message: string): {startDate: Date | null, endDate: Date | null, periodName: string} {
  const lowerMessage = message.toLowerCase();
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let periodName = "recently";
  
  if (lowerMessage.includes('last month') || lowerMessage.includes('previous month')) {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    periodName = "last month";
  } else if (lowerMessage.includes('this month')) {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = now;
    periodName = "this month";
  } else if (lowerMessage.includes('last week') || lowerMessage.includes('previous week')) {
    const day = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - day - 7);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    periodName = "last week";
  } else if (lowerMessage.includes('this week')) {
    const day = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - day);
    endDate = now;
    periodName = "this week";
  } else if (lowerMessage.includes('yesterday')) {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
    periodName = "yesterday";
  } else if (lowerMessage.includes('today')) {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = now;
    periodName = "today";
  } else if (lowerMessage.includes('last year') || lowerMessage.includes('previous year')) {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31);
    periodName = "last year";
  } else if (lowerMessage.includes('this year')) {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
    periodName = "this year";
  } else {
    // Default to last 30 days if no specific time mentioned
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    endDate = now;
    periodName = "the last 30 days";
  }
  
  return { startDate, endDate, periodName };
}

// Enhanced function to handle top emotions query using the new SQL function
async function handleTopEmotionsQuery(userId: string, timeRange: {startDate: Date | null, endDate: Date | null, periodName: string}, isWhyQuery: boolean) {
  try {
    // Use the new SQL function to get top emotions with sample entries
    const { data: emotionsData, error } = await supabase.rpc(
      'get_top_emotions_with_entries',
      {
        user_id_param: userId,
        start_date: timeRange.startDate?.toISOString() || null,
        end_date: timeRange.endDate?.toISOString() || null,
        limit_count: 3
      }
    );
    
    if (error) {
      console.error("Error fetching top emotions:", error);
      return null;
    }
    
    if (!emotionsData || emotionsData.length === 0) {
      return {
        formattedEmotions: null,
        relevantEntries: []
      };
    }
    
    // Extract relevant entries for context
    const relevantEntries: any[] = [];
    const emotionSamples: Record<string, string[]> = {};
    
    emotionsData.forEach(emotion => {
      const sampleEntries = emotion.sample_entries;
      emotionSamples[emotion.emotion] = [];
      
      if (sampleEntries && Array.isArray(sampleEntries)) {
        sampleEntries.forEach(entry => {
          relevantEntries.push({
            id: entry.id,
            date: entry.created_at,
            snippet: entry.content,
            emotion: emotion.emotion,
            score: emotion.score
          });
          
          emotionSamples[emotion.emotion].push(entry.content);
        });
      }
    });
    
    // Format the emotions for display
    const formattedEmotions = emotionsData.map(e => `${e.emotion} (${e.score})`).join(', ');
    
    // For 'why' queries, we'll use GPT to analyze the patterns
    let emotionContext = '';
    if (isWhyQuery) {
      emotionContext = "Here are sample entries for each emotion:\n\n";
      
      Object.entries(emotionSamples).forEach(([emotion, samples]) => {
        emotionContext += `${emotion.toUpperCase()}:\n`;
        samples.forEach((sample, i) => {
          emotionContext += `Entry ${i+1}: "${sample.substring(0, 200)}..."\n`;
        });
        emotionContext += '\n';
      });
    }
    
    return {
      formattedEmotions,
      emotionContext,
      topEmotionsData: emotionsData,
      relevantEntries
    };
  } catch (error) {
    console.error("Error in handleTopEmotionsQuery:", error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, threadId = null, includeDiagnostics = false, requiresEmotionAnalysis = false } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    
    // Analyze query type
    const isEmotionQuery = isTopEmotionsQuery(message);
    const isWhyEmotionQuery = isEmotionWhyQuery(message);
    const timeRange = extractTimePeriod(message);
    
    console.log("Query analysis:", {
      isEmotionQuery,
      isWhyEmotionQuery,
      timeRange: timeRange.periodName
    });
    
    // If this is a top emotions query, handle it specifically
    let emotionAnalysisData = null;
    if (isEmotionQuery) {
      emotionAnalysisData = await handleTopEmotionsQuery(userId, timeRange, isWhyEmotionQuery);
      console.log("Emotion analysis completed:", emotionAnalysisData ? "success" : "failed");
    }
    
    // Generate embedding for the user query
    console.log("Generating embedding for user query...");
    const queryEmbedding = await generateEmbedding(message);
    console.log("Using embedding for search");
    
    // Search for relevant journal entries using vector similarity
    let journalContext = "";
    let relevantEntries = emotionAnalysisData?.relevantEntries || [];
    
    if (!emotionAnalysisData || relevantEntries.length < 3) {
      console.log("Searching for relevant context using vector similarity...");
      const { data: similarEntries, error: searchError } = await supabase.rpc(
        'match_journal_entries_with_date',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 5,
          user_id_filter: userId,
          start_date: timeRange.startDate?.toISOString() || null,
          end_date: timeRange.endDate?.toISOString() || null
        }
      );
      
      if (searchError) {
        console.error("Error searching for similar entries:", searchError);
      } else if (similarEntries && similarEntries.length > 0) {
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
          
          // Add to relevant entries if not already included from emotion analysis
          const existingIds = new Set(relevantEntries.map(e => e.id));
          
          entries.forEach((entry, index) => {
            if (!existingIds.has(entry.id)) {
              relevantEntries.push({
                id: entry.id,
                date: entry.created_at,
                snippet: entry["refined text"] || "No content available",
                similarity: similarEntries[index]?.similarity || null
              });
            }
          });
          
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
          
          relevantEntries = recentEntries.map((entry, index) => ({
            id: entry.id,
            date: entry.created_at,
            snippet: entry["refined text"] || "No content available"
          }));
          
          journalContext = "Here are some of your recent journal entries:\n\n" + 
            recentEntries.map((entry, index) => {
              const date = new Date(entry.created_at).toLocaleDateString();
              const emotionsText = formatEmotions(entry.emotions);
              return `Entry ${index+1} (${date}):\n${entry["refined text"]}\nPrimary emotions: ${emotionsText}`;
            }).join('\n\n') + "\n\n";
        }
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
    
    // For top emotions queries, prepare emotional context
    let emotionPrompt = "";
    if (emotionAnalysisData && isEmotionQuery) {
      if (isWhyEmotionQuery && emotionAnalysisData.emotionContext) {
        // Add emotion samples for GPT to analyze why these emotions were felt
        emotionPrompt = `The user is asking about their top emotions during ${timeRange.periodName} and why they felt these emotions.
Based on their journal entries, their top emotions were: ${emotionAnalysisData.formattedEmotions}.

${emotionAnalysisData.emotionContext}

Analyze these entries and explain why the user likely experienced these emotions during ${timeRange.periodName}. 
Identify patterns, triggers, and common themes in the journal entries. 
Provide a thoughtful analysis that helps the user understand their emotional patterns.
Keep your response conversational and supportive.
`;
      } else {
        // Just inform about top emotions without the 'why' analysis
        emotionPrompt = `The user is asking about their top emotions during ${timeRange.periodName}.
Based on their journal entries, their top emotions were: ${emotionAnalysisData.formattedEmotions}.

Provide a concise summary of these emotions and their general patterns during this period.
Keep your response conversational and supportive.
`;
      }
    }
    
    // Fetch previous conversation messages if a thread ID is provided
    let conversationContext = "";
    if (threadId) {
      try {
        console.log("Fetching previous messages for conversation context...");
        const { data: prevMessages, error: msgsError } = await supabase
          .from('chat_messages')
          .select('content, sender')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true })
          .limit(5);
          
        if (!msgsError && prevMessages && prevMessages.length > 0) {
          console.log("Retrieved", prevMessages.length, "previous messages");
          
          conversationContext = "Previous conversation:\n";
          prevMessages.forEach(msg => {
            const role = msg.sender === 'user' ? 'User' : 'Assistant';
            conversationContext += `${role}: ${msg.content}\n`;
          });
          
          console.log("Including previous conversation context");
        }
      } catch (error) {
        console.error("Error fetching previous messages:", error);
      }
    }
    
    // Prepare system prompt with context
    const systemPrompt = emotionPrompt || `You are Roha, an AI assistant specialized in emotional wellbeing and journaling. 
${journalContext ? journalContext : "I don't have access to any of your journal entries yet. Feel free to use the journal feature to record your thoughts and feelings."}
${conversationContext ? conversationContext : ""}

Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic. 
${firstName ? `Always address the user by their first name (${firstName}) in your responses.` : ""}`;

    console.log("Sending to GPT with RAG context and conversation history...");
    
    try {
      // Send to GPT with context
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
      
      // Prepare response object
      const responseObject: any = { 
        response: aiResponse,
        success: true 
      };
      
      // Include relevant entries if found
      if (relevantEntries && relevantEntries.length > 0) {
        responseObject.diagnostics = { 
          relevantEntries 
        };
      }
      
      // Include emotion analysis data if available
      if (emotionAnalysisData && emotionAnalysisData.topEmotionsData) {
        responseObject.analysis = {
          type: 'top_emotions',
          data: emotionAnalysisData.topEmotionsData
        };
        responseObject.hasNumericResult = true;
      }
      
      return new Response(
        JSON.stringify(responseObject),
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
