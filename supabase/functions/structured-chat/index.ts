
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// Maximum number of previous messages to include for context
const MAX_CONTEXT_MESSAGES = 10;

// Define the structured prompt template
const STRUCTURED_PROMPT = `
# 1. Bot Identity + Personality

You are SOuLO, a compassionate and reflective AI journaling coach.
- Speak like a calm, emotionally intelligent human.
- You are curious, non-judgmental, and insightful.
- You are trained in reflective psychology and mindfulness-based coaching.
- Your goal is to help the user understand their emotions and thought patterns through compassionate inquiry.

# 2. User Context

{userContext}

# 3. Query Context

User Query: "{userMessage}"

Query Type:
- Requires pattern recognition? {isPatternQuery}
- Is emotion-focused? {isEmotionFocused}
- Has time range? {timeRangeSummary}
- Requires stats/quantification? {isQuantitative}
- Needs clarification? {needsClarification}

# 4. Journal Context

Relevant journal entries:
{journalEntries}

# 5. Conversation History

Recent conversation history (for tone continuity):
{conversationHistory}

# 6. Response Guidelines

Use these rules while generating your response:
- Mirror the user's tone: warm, calm, encouraging, or somber as needed.
- Use human-like phrasing: "Sounds like...", "Could it be that...", "You might be feeling..."
- Ask a gentle reflective follow-up at the end when appropriate.
- Always reference the user's own journal data when giving insight.
- When giving stats (e.g., "3 out of 5 entries mentioned fear"), speak like a therapist, not a dashboard.
- Personalize based on emotion trends or specific phrases the user often repeats.
- Use contractions and avoid sounding robotic. Be fluid and real.
- Only use facts from journal entries — no assumptions, no hallucinations.
- If data is insufficient, say so clearly and gently suggest journaling directions.
`;

// Function to get user name and profile data
async function getUserContextData(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    
    return data || {};
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return {};
  }
}

// Function to get user's top emotions
async function getUserEmotions(userId, days = 30) {
  try {
    const timeLimit = new Date();
    timeLimit.setDate(timeLimit.getDate() - days);
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('emotions')
      .eq('user_id', userId)
      .gt('created_at', timeLimit.toISOString())
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Extract all emotions
    const allEmotions = [];
    data?.forEach(entry => {
      if (entry.emotions && Array.isArray(entry.emotions)) {
        entry.emotions.forEach(emotion => {
          if (emotion && emotion.name) {
            allEmotions.push(emotion.name);
          }
        });
      }
    });
    
    // Count occurrences of each emotion
    const emotionCount = {};
    allEmotions.forEach(emotion => {
      emotionCount[emotion] = (emotionCount[emotion] || 0) + 1;
    });
    
    // Sort emotions by count and get top 5
    const topEmotions = Object.entries(emotionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
      
    return topEmotions;
  } catch (error) {
    console.error("Error fetching user emotions:", error);
    return [];
  }
}

// Function to analyze journal entries for common themes
async function getJournalThemes(userId, days = 30) {
  try {
    const timeLimit = new Date();
    timeLimit.setDate(timeLimit.getDate() - days);
    
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('master_themes')
      .eq('user_id', userId)
      .gt('created_at', timeLimit.toISOString());
      
    if (error) throw error;
    
    // Extract all themes
    const allThemes = [];
    data?.forEach(entry => {
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        allThemes.push(...entry.master_themes);
      }
    });
    
    // Count occurrences of each theme
    const themeCount = {};
    allThemes.forEach(theme => {
      if (theme) {
        themeCount[theme] = (themeCount[theme] || 0) + 1;
      }
    });
    
    // Sort themes by count and get top 5
    const topThemes = Object.entries(themeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
      
    return topThemes;
  } catch (error) {
    console.error("Error fetching journal themes:", error);
    return [];
  }
}

// Build user context string from available data
async function buildUserContext(userId) {
  try {
    const profile = await getUserContextData(userId);
    const topEmotions = await getUserEmotions(userId);
    const dominantThemes = await getJournalThemes(userId);
    
    let userContext = '';
    
    // Add user name if available
    if (profile.full_name) {
      userContext += `The user's name is ${profile.full_name}.\n`;
    } else if (profile.display_name) {
      userContext += `The user's name is ${profile.display_name}.\n`;
    }
    
    // Add top emotions if available
    if (topEmotions.length > 0) {
      const emotionNames = topEmotions.map(e => e.name).join(', ');
      userContext += `Top emotions over the last 30 days: ${emotionNames}.\n`;
    }
    
    // Add dominant themes if available
    if (dominantThemes.length > 0) {
      const themeNames = dominantThemes.map(t => t.name).join(', ');
      userContext += `Common journal themes: ${themeNames}.\n`;
    }
    
    return userContext || 'No user context available.';
  } catch (error) {
    console.error("Error building user context:", error);
    return 'Error retrieving user context.';
  }
}

// Function to analyze the query type
function analyzeQueryType(message) {
  // Check for emotion-focused queries
  const emotionKeywords = ['feel', 'feeling', 'emotion', 'mood', 'happy', 'sad', 'angry', 'anxiety', 'depressed', 'stress'];
  const isEmotionFocused = emotionKeywords.some(keyword => message.toLowerCase().includes(keyword));
  
  // Check for quantitative queries
  const quantitativeKeywords = ['how many', 'how often', 'how much', 'count', 'times', 'frequency', 'most', 'least', 'average'];
  const isQuantitative = quantitativeKeywords.some(keyword => message.toLowerCase().includes(keyword));
  
  // Check for pattern recognition queries
  const patternKeywords = ['pattern', 'trend', 'notice', 'correlation', 'relationship', 'connection', 'linked', 'associated'];
  const isPatternQuery = patternKeywords.some(keyword => message.toLowerCase().includes(keyword));
  
  // Check for time-related queries
  const timeKeywords = ['yesterday', 'last week', 'last month', 'recently', 'past', 'when', 'date', 'day', 'time'];
  const hasTimeRange = timeKeywords.some(keyword => message.toLowerCase().includes(keyword));
  
  // Determine if clarification might be needed
  const needsClarification = message.length < 10 || message.split(' ').length < 3;
  
  // Determine time range summary
  let timeRangeSummary = 'No specific time range mentioned';
  if (message.toLowerCase().includes('yesterday')) {
    timeRangeSummary = 'Yesterday';
  } else if (message.toLowerCase().includes('last week')) {
    timeRangeSummary = 'Last week';
  } else if (message.toLowerCase().includes('last month')) {
    timeRangeSummary = 'Last month';
  } else if (message.toLowerCase().includes('recent')) {
    timeRangeSummary = 'Recent past';
  }
  
  return {
    isEmotionFocused,
    isQuantitative,
    isPatternQuery,
    hasTimeRange,
    needsClarification,
    timeRangeSummary
  };
}

// Format journal entries for the prompt
function formatJournalEntries(entries) {
  if (!entries || entries.length === 0) {
    return "No relevant journal entries found.";
  }
  
  return entries.map(entry => {
    const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "Unknown date";
    const content = entry.content || entry.snippet || "No content available.";
    
    let formattedEntry = `- Date: ${date}\n- Text: "${content}"\n`;
    
    // Add emotions if available
    if (entry.emotions) {
      const emotions = Array.isArray(entry.emotions) 
        ? entry.emotions.map(e => typeof e === 'object' ? e.name : e).join(', ') 
        : entry.emotions;
      formattedEntry += `- Emotions: ${emotions}\n`;
    }
    
    // Add themes if available
    if (entry.themes || entry.master_themes) {
      const themes = entry.themes || entry.master_themes || [];
      const formattedThemes = Array.isArray(themes) ? themes.join(', ') : themes;
      formattedEntry += `- Themes: ${formattedThemes}\n`;
    }
    
    return formattedEntry;
  }).join('\n');
}

// Format conversation history for the prompt
function formatConversationHistory(messages) {
  if (!messages || messages.length === 0) {
    return "No previous conversation.";
  }
  
  return messages.map(msg => {
    const role = msg.sender === 'user' ? 'User' : 'SOuLO';
    return `${role}: ${msg.content}`;
  }).join('\n\n');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, timeRange, threadId, entries } = await req.json();

    if (!message) {
      throw new Error('Message is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Processing message for user ${userId}: ${message.substring(0, 50)}...`);
    
    // Get conversation history if thread ID is provided
    let conversationHistory = [];
    if (threadId) {
      const { data: previousMessages, error } = await supabase
        .from('chat_messages')
        .select('content, sender, created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(MAX_CONTEXT_MESSAGES);
      
      if (!error && previousMessages) {
        // Reverse to get chronological order
        conversationHistory = [...previousMessages].reverse();
      }
    }
    
    // Build the query analysis
    const queryAnalysis = analyzeQueryType(message);
    
    // Build user context
    const userContext = await buildUserContext(userId);
    
    // Format journal entries provided from the frontend
    const formattedEntries = formatJournalEntries(entries);
    
    // Format conversation history
    const formattedHistory = formatConversationHistory(conversationHistory);
    
    // Build the complete prompt
    let completePrompt = STRUCTURED_PROMPT
      .replace('{userContext}', userContext)
      .replace('{userMessage}', message)
      .replace('{isPatternQuery}', String(queryAnalysis.isPatternQuery))
      .replace('{isEmotionFocused}', String(queryAnalysis.isEmotionFocused))
      .replace('{timeRangeSummary}', queryAnalysis.timeRangeSummary)
      .replace('{isQuantitative}', String(queryAnalysis.isQuantitative))
      .replace('{needsClarification}', String(queryAnalysis.needsClarification))
      .replace('{journalEntries}', formattedEntries)
      .replace('{conversationHistory}', formattedHistory);
      
    console.log("Using structured prompt with comprehensive context");
    
    // Call OpenAI with the structured prompt
    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: completePrompt 
          },
          { 
            role: 'user', 
            content: message 
          }
        ],
        temperature: 0.7
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const responseContent = completionData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    
    console.log("Response generated successfully with structured prompt");

    // Return the response with relevant metadata
    return new Response(
      JSON.stringify({ 
        data: responseContent,
        processingComplete: true,
        references: entries,
        metadata: {
          queryAnalysis: queryAnalysis,
          promptStructure: "6-block structured prompt"
        }
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processingComplete: true
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
