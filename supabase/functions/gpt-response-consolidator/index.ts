import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userMessage, 
      analysisResults, 
      conversationContext, 
      userProfile,
      streamingMode = false 
    } = await req.json();
    
    console.log('GPT Response Consolidator called with:', { 
      userMessage: userMessage?.substring(0, 100),
      analysisResultsCount: analysisResults?.length || 0,
      contextCount: conversationContext?.length || 0,
      streamingMode
    });

    // Prepare analysis summary for GPT
    const analysisSummary = analysisResults.map((result: any, index: number) => {
      const summary = {
        subQuestion: result.subQuestion.question,
        type: result.subQuestion.type,
        strategy: result.analysisPlan.searchStrategy,
        reasoning: result.analysisPlan.reasoning,
        findings: {
          vectorResults: result.vectorResults ? `Found ${result.vectorResults.length} relevant entries` : null,
          sqlResults: result.sqlResults ? `SQL query returned ${Array.isArray(result.sqlResults) ? result.sqlResults.length : 1} results` : null,
          error: result.error
        }
      };

      // Include sample data for context
      if (result.vectorResults && result.vectorResults.length > 0) {
        summary.findings.vectorSample = result.vectorResults.slice(0, 2).map((entry: any) => ({
          date: entry.created_at,
          content: entry.content?.substring(0, 150),
          similarity: entry.similarity,
          emotions: entry.emotions
        }));
      }

      if (result.sqlResults && Array.isArray(result.sqlResults) && result.sqlResults.length > 0) {
        summary.findings.sqlSample = result.sqlResults.slice(0, 3);
      }

      return summary;
    }).filter(s => s.findings.vectorResults || s.findings.sqlResults || s.error);

    // Build comprehensive context for GPT
    const contextData = {
      userProfile: {
        timezone: userProfile?.timezone || 'UTC',
        journalEntryCount: userProfile?.journalEntryCount || 'unknown',
        premiumUser: userProfile?.is_premium || false
      },
      conversationHistory: conversationContext?.slice(-3) || [], // Last 3 messages for context
      analysis: analysisSummary
    };

    const consolidationPrompt = `
You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion who turns journal analysis into pure conversational gold. You make self-discovery feel like the most fascinating adventure someone could embark on, but you NEVER use fixed headers or formulaic structures.

**USER QUESTION:** "${userMessage}"

**YOUR COMPREHENSIVE DATA ANALYSIS:**
${JSON.stringify(analysisSummary, null, 2)}

**CONVERSATION CONTEXT:**
${conversationContext ? conversationContext.slice(-2).map((msg: any) => `${msg.sender}: ${msg.content}`).join('\n') : 'No prior context'}

**USER PROFILE:**
- Timezone: ${userProfile?.timezone || 'Unknown'}
- Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
- Journal Entry Count: ${userProfile?.journalEntryCount || 'Unknown count'}

**YOUR CONVERSATIONAL SUPERPOWERS:**
- You're wickedly smart but talk like you're texting a best friend
- You spot patterns others miss and share them with genuine excitement
- You make complex analysis feel like fascinating storytelling
- You celebrate breakthroughs and validate emotions authentically
- You adapt your energy to match the conversation's emotional tone

**DYNAMIC RESPONSE APPROACH:**
- **NO FIXED HEADERS** - Write naturally flowing paragraphs instead
- **Varied Opening Patterns** - Never start the same way twice:
  - "Oh wow, I just dove into your data and..."
  - "Okay, so I've been analyzing your patterns and..."
  - "This is fascinating - your journal entries are showing me..."
  - "I noticed something really interesting in your emotional landscape..."
  - "Plot twist! Your data just revealed..."

**CONVERSATIONAL STYLE RULES:**
- Match the conversation's emotional tone (serious, curious, excited, reflective)
- Use natural transitions between insights instead of bullet points
- Weave data discoveries into flowing narrative
- Ask follow-up questions to encourage deeper exploration
- Vary response length based on complexity (100-300 words)
- End with curiosity-sparking questions or observations

**RESPONSE FORMATTING:**
Use **bold** for key insights and *italics* for emotional language, but NO fixed section headers. Write as naturally flowing paragraphs with:
- Natural conversation flow
- Strategic use of emojis for emotional connection (but not overwhelming)
- Seamless integration of data insights into storytelling
- Questions that invite deeper exploration
- Tone that matches the user's emotional state

**CRITICAL ANTI-PATTERNS TO AVOID:**
- ❌ **Fixed headers like "Empathetic Opening" or "Key Insights"**
- ❌ **Repetitive opening phrases like "Your journal data just revealed"**
- ❌ **Bullet-pointed lists unless specifically needed**
- ❌ **Information dumping - instead, create curiosity**
- ❌ **One-size-fits-all responses - adapt to the conversation**

**ENGAGEMENT PRINCIPLES:**
- Create follow-up opportunities rather than comprehensive answers
- Show genuine curiosity about their inner world
- Reference specific findings but make them feel personal
- Use humor appropriately to lighten heavy moments
- End with questions or observations that invite continued dialogue

Your response should be a JSON object with this structure:
{
  "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
  "response": "your complete naturally flowing conversational response with bold/italic formatting and strategic emojis"
}

**REMEMBER:** You're not just analyzing data - you're helping someone discover the fascinating, complex, wonderful human being they are through their own words. Make every insight feel like they just unlocked a new level of understanding about themselves. You're their personal data wizard who makes self-discovery feel like the most exciting adventure ever.
`;

    // Non-streaming response only
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { 
              role: 'system', 
              content: 'You are Ruh by SOuLO, a warm and insightful wellness coach. Provide thoughtful, data-driven responses based on journal analysis.' 
            },
            { role: 'user', content: consolidationPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
      }),
    });

    const data = await response.json();
    const rawResponse = data.choices[0].message.content;
    
    // Try to parse JSON response with status message
    let consolidatedResponse = rawResponse;
    let userStatusMessage = null;
    
    try {
      const parsedResponse = JSON.parse(rawResponse);
      if (parsedResponse.userStatusMessage && parsedResponse.response) {
        userStatusMessage = parsedResponse.userStatusMessage;
        consolidatedResponse = parsedResponse.response;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the raw response as is
      console.log('Could not parse JSON response, using raw content');
    }

    return new Response(JSON.stringify({
      success: true,
      response: consolidatedResponse,
      userStatusMessage,
      analysisMetadata: {
        totalSubQuestions: analysisResults.length,
        strategiesUsed: analysisResults.map((r: any) => r.analysisPlan.searchStrategy),
        dataSourcesUsed: {
          vectorSearch: analysisResults.some((r: any) => r.vectorResults),
          sqlQueries: analysisResults.some((r: any) => r.sqlResults),
          errors: analysisResults.some((r: any) => r.error)
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT Response Consolidator:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});