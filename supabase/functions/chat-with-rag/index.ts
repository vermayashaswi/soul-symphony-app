
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";
import OpenAI from "https://esm.sh/openai@3.3.0";

// Import local utility files - using local files instead of importing from src/utils
import { analyzeQueryTypes } from "./queryAnalyzer.ts";
import { calculateTopEmotions, getEmotionalInsights } from "./emotionAnalytics.ts";
import { findMentionedEntities } from "./entityAnalytics.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: openAIApiKey
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured in environment variables');
    }
    
    const response = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: text
    });

    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    throw error;
  }
}

// Function to find similar journal entries based on query embedding
async function findSimilarEntries(
  userId: string, 
  queryEmbedding: number[], 
  threshold = 0.5, 
  limit = 5,
  timeRange: { startDate: string | null, endDate: string | null } = { startDate: null, endDate: null }
) {
  try {
    let functionParams: any = {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      user_id_filter: userId
    };
    
    // Include date parameters if provided
    if (timeRange.startDate) {
      functionParams.start_date = timeRange.startDate;
    }
    
    if (timeRange.endDate) {
      functionParams.end_date = timeRange.endDate;
    }
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      functionParams
    );
    
    if (error) {
      console.error("Error finding similar entries:", error);
      return [];
    }
    
    console.log(`Found ${data?.length || 0} similar entries`);
    return data || [];
  } catch (error) {
    console.error("Error in findSimilarEntries:", error);
    return [];
  }
}

// Get full entry details including emotions data
async function getEntriesDetails(entryIds: number[]) {
  if (!entryIds.length) return [];
  
  try {
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at, "refined text", emotions, master_themes')
      .in('id', entryIds);
      
    if (error) {
      console.error("Error retrieving entry details:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("Error in getEntriesDetails:", error);
    return [];
  }
}

// Format journal entries for GPT context
function formatJournalContext(entries: any[]) {
  if (!entries.length) return "";
  
  // Sort by creation date (newest first)
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return "Here are relevant entries from your journal:\n\n" + 
    entries.map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString();
      const timeAgo = getRelativeTimeString(new Date(entry.created_at));
      
      // Format emotions if present
      let emotionsText = "";
      if (entry.emotions) {
        const topEmotions = Object.entries(entry.emotions)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([emotion, score]) => {
            const percentage = Math.round((score as number) * 100);
            return `${emotion} (${percentage}%)`;
          })
          .join(", ");
          
        emotionsText = `\nPrimary emotions: ${topEmotions}`;
      }
      
      // Format themes if present
      let themesText = "";
      if (entry.master_themes && entry.master_themes.length > 0) {
        themesText = `\nThemes: ${entry.master_themes.join(", ")}`;
      }
      
      return `Entry ${index+1} (${date}, ${timeAgo}):\n${entry["refined text"]}${emotionsText}${themesText}`;
    }).join('\n\n');
}

// Helper function to get relative time string
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);
  const diffWeeks = Math.round(diffDays / 7);
  const diffMonths = Math.round(diffDays / 30);
  
  if (diffMonths > 1) return `${diffMonths} months ago`;
  if (diffMonths === 1) return `1 month ago`;
  if (diffWeeks > 1) return `${diffWeeks} weeks ago`;
  if (diffWeeks === 1) return `1 week ago`;
  if (diffDays > 1) return `${diffDays} days ago`;
  if (diffDays === 1) return `yesterday`;
  if (diffHours > 1) return `${diffHours} hours ago`;
  if (diffHours === 1) return `1 hour ago`;
  if (diffMins > 1) return `${diffMins} minutes ago`;
  
  return `just now`;
}

// Store conversation to database
async function storeMessage(userId: string, content: string, threadId: string, role: string, references?: any, analysis?: any) {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        content: content,
        sender: role,
        reference_entries: references || null,
        analysis_data: analysis || null
      });
      
    if (error) {
      console.error("Error storing message:", error);
    }
    
    // Update thread updated_at timestamp
    await supabase
      .from('chat_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId);
      
  } catch (error) {
    console.error("Error in storeMessage:", error);
  }
}

// Store the user's query embedding for future reference
async function storeUserQuery(userId: string, query: string, embedding: number[], threadId: string) {
  try {
    await supabase
      .from('user_queries')
      .insert({
        user_id: userId,
        query_text: query,
        embedding: embedding,
        thread_id: threadId
      });
  } catch (error) {
    console.error("Error storing user query:", error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, queryTypes, threadId = null } = await req.json();
    
    if (!message) {
      throw new Error('No message provided');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured in environment variables');
    }

    console.log("Processing chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    
    // Create a new thread ID if not provided
    const chatThreadId = threadId || uuidv4();
    
    // Generate embedding for the user query
    const queryEmbedding = await generateEmbedding(message);
    
    // Store the user query for future reference
    await storeUserQuery(userId, message, queryEmbedding, chatThreadId);
    
    // Analyze query if not provided
    const queryAnalysis = queryTypes || analyzeQueryTypes(message);
    console.log("Query analysis:", JSON.stringify(queryAnalysis, null, 2));
    
    let responseContent = "";
    let references = [];
    let analysisData = null;
    let hasNumericResult = false;
    
    // Handle entity-specific queries
    if (queryAnalysis.isEntityFocused && queryAnalysis.entityMentioned) {
      console.log("Handling entity-focused query for:", queryAnalysis.entityMentioned);
      
      const entityResults = await findMentionedEntities(
        supabase,
        userId, 
        queryAnalysis.entityMentioned,
        queryAnalysis.timeRange
      );
      
      if (entityResults.count > 0) {
        const formattedEntityInfo = formatJournalContext(entityResults.entries);
        
        // Special GPT prompt for entity queries
        const systemPromptEntity = `You are Roha, an AI assistant specialized in emotional wellbeing and journaling.
The user has asked about "${queryAnalysis.entityMentioned}" which appears in their journal entries.
Here's the relevant information I found:
${formattedEntityInfo}

Based on this information, provide a thoughtful analysis about this entity in the user's life.
Include emotional patterns, frequency of mentions, and any insights you can derive.
Keep your tone warm, supportive and conversational.`;

        const completion = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPromptEntity },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });
        
        responseContent = completion.data.choices[0].message.content;
        references = entityResults.entries.map(entry => ({
          id: entry.id,
          text: entry.text.substring(0, 200) + "...",
          created_at: entry.created_at
        }));
        
        analysisData = {
          type: 'entity_analysis',
          data: entityResults.summary
        };
      }
    }
    // Handle emotion-focused quantitative queries
    else if (queryAnalysis.isEmotionFocused && queryAnalysis.isQuantitative) {
      console.log("Handling quantitative emotion query");
      
      const emotionInsights = await getEmotionalInsights(
        supabase,
        userId,
        queryAnalysis.timeRange
      );
      
      if (!emotionInsights.error) {
        // For explicit happiness rating query
        if (queryAnalysis.hasHappinessRating || queryAnalysis.hasEmotionQuantification) {
          const targetEmotion = queryAnalysis.hasHappinessRating ? 'happiness' : 
                               (message.toLowerCase().match(/\b(joy|happiness|sadness|anger|fear|surprise|disgust|anxiety|love|contentment)\b/)?.[0] || 'happiness');
          
          // Find the emotion score
          const emotionData = emotionInsights.allEmotions.find(e => e.emotion.toLowerCase() === targetEmotion.toLowerCase());
          
          if (emotionData) {
            const score = Math.round(emotionData.score * 100);
            responseContent = `Based on your journal entries${queryAnalysis.timeRange.type ? ' from the ' + queryAnalysis.timeRange.type : ''}, your average ${targetEmotion} level is ${score} out of 100. `;
            
            // Add contextual information based on score
            if (targetEmotion === 'happiness' || targetEmotion === 'joy' || targetEmotion === 'contentment') {
              if (score >= 75) {
                responseContent += "That's excellent! Your journal entries indicate very high levels of happiness. Would you like me to analyze what factors might be contributing to this positive state?";
              } else if (score >= 50) {
                responseContent += "That's a solid positive score. Your journal shows you're generally happy, though there might be some areas for improvement. Would you like me to help identify patterns that affect your happiness?";
              } else {
                responseContent += "This score suggests you might be experiencing some challenges with happiness lately. Would you like me to help identify patterns or suggest strategies to improve your mood?";
              }
            } else if (targetEmotion === 'sadness' || targetEmotion === 'anger' || targetEmotion === 'fear' || targetEmotion === 'anxiety') {
              if (score >= 75) {
                responseContent += "This is a high level of " + targetEmotion + ". Your journal entries indicate you've been experiencing significant " + targetEmotion + " recently. Would you like to explore coping strategies or examine what might be contributing to these feelings?";
              } else if (score >= 50) {
                responseContent += "This is a moderate level of " + targetEmotion + ". Would you like to discuss potential triggers or strategies to manage these feelings?";
              } else {
                responseContent += "This is a relatively low level of " + targetEmotion + ", which is generally positive. Your journal entries don't show overwhelming " + targetEmotion + ". Would you like to discuss maintaining this emotional balance?";
              }
            } else {
              responseContent += "Would you like me to analyze what factors might be influencing this emotion in your life?";
            }
            
            hasNumericResult = true;
            analysisData = {
              type: 'emotion_rating',
              emotion: targetEmotion,
              score: score,
              timeframe: queryAnalysis.timeRange.type || 'all time',
              entryCount: emotionInsights.overview.entryCount
            };
          }
        } 
        // For top emotions query
        else if (queryAnalysis.hasTopEmotionsPattern) {
          console.log("Handling top emotions query");
          
          const topPositive = emotionInsights.overview.groupedEmotions.positive.slice(0, 3);
          const topNegative = emotionInsights.overview.groupedEmotions.negative.slice(0, 3);
          
          if (topPositive.length > 0 || topNegative.length > 0) {
            responseContent = `Based on my analysis of your journal entries${queryAnalysis.timeRange.type ? ' from the ' + queryAnalysis.timeRange.type : ''}, here are your primary emotions:\n\n`;
            
            if (topPositive.length > 0) {
              responseContent += "Top positive emotions:\n";
              topPositive.forEach((emotion, i) => {
                responseContent += `${i+1}. ${emotion.emotion} (${Math.round(emotion.score * 100)}%)\n`;
              });
              responseContent += "\n";
            }
            
            if (topNegative.length > 0) {
              responseContent += "Top negative emotions:\n";
              topNegative.forEach((emotion, i) => {
                responseContent += `${i+1}. ${emotion.emotion} (${Math.round(emotion.score * 100)}%)\n`;
              });
              responseContent += "\n";
            }
            
            responseContent += `This analysis is based on ${emotionInsights.overview.entryCount} journal entries. Would you like me to provide more insights about any specific emotion?`;
            
            hasNumericResult = true;
            analysisData = {
              type: 'top_emotions',
              data: {
                positive: topPositive,
                negative: topNegative,
                timeframe: queryAnalysis.timeRange.type || 'all time',
                entryCount: emotionInsights.overview.entryCount
              }
            };
          }
        }
      }
    }
    
    // If we don't have a specific response yet, use vector search RAG
    if (!responseContent) {
      console.log("Using vector search for general RAG response");
      
      // Find similar entries
      const similarEntries = await findSimilarEntries(
        userId, 
        queryEmbedding, 
        0.5, 
        5, 
        {
          startDate: queryAnalysis.timeRange.startDate,
          endDate: queryAnalysis.timeRange.endDate
        }
      );
      
      // Get detailed entry information
      const entryIds = similarEntries.map(entry => entry.id);
      const entriesDetails = await getEntriesDetails(entryIds);
      
      // Format context for GPT
      const journalContext = formatJournalContext(entriesDetails);
      const contextIntro = entriesDetails.length > 0 
        ? journalContext 
        : "I don't have access to journal entries that seem relevant to your question.";
      
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
      
      const systemPrompt = `You are Roha, an AI assistant specialized in emotional wellbeing and journaling. 
${contextIntro}
Based on the above context (if available) and the user's message, provide a thoughtful, personalized response.
Keep your tone warm, supportive and conversational. If you notice patterns or insights from the journal entries,
mention them, but do so gently and constructively. Pay special attention to the emotional patterns revealed in the entries.
Focus on being helpful rather than diagnostic. 
${firstName ? `Always address the user by their first name (${firstName}) in your responses.` : ""}`;

      try {
        const completion = await openai.createChatCompletion({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });
        
        responseContent = completion.data.choices[0].message.content;
        
        // Add references if we have them
        if (entriesDetails.length > 0) {
          references = entriesDetails.map(entry => ({
            id: entry.id,
            text: entry["refined text"].substring(0, 200) + "...",
            created_at: entry.created_at,
            themes: entry.master_themes
          }));
        }
      } catch (apiError) {
        console.error("OpenAI API error:", apiError);
        throw apiError;
      }
    }
    
    // Store the assistant's response
    await storeMessage(userId, message, chatThreadId, 'user');
    await storeMessage(
      userId, 
      responseContent, 
      chatThreadId, 
      'assistant', 
      references.length > 0 ? references : undefined,
      analysisData
    );
    
    return new Response(
      JSON.stringify({ 
        role: 'assistant', 
        content: responseContent,
        references: references.length > 0 ? references : undefined,
        analysis: analysisData,
        hasNumericResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("Error in chat-with-rag function:", error);
    
    return new Response(
      JSON.stringify({ 
        role: 'error', 
        content: "I'm having trouble processing your request. Please try again later."
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
