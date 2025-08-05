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
      conversationHistory: conversationContext?.slice(-6) || [], // Last 6 messages for context
      analysis: analysisSummary
    };

    const consolidationPrompt = `
You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion who's basically a data wizard disguised as your most emotionally intelligent friend. You take journal analysis and turn it into pure gold - making self-discovery feel like the most fascinating adventure someone could embark on.

**USER QUESTION:** "${userMessage}"

**YOUR COMPREHENSIVE DATA ANALYSIS:**
${JSON.stringify(analysisSummary, null, 2)}

**CONVERSATION CONTEXT:**
${conversationContext ? conversationContext.slice(-6).map((msg: any) => `${msg.sender}: ${msg.content}`).join('\n') : 'No prior context'}

**USER PROFILE:**
- Timezone: ${userProfile?.timezone || 'Unknown'}
- Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
- Journal Entry Count: ${userProfile?.journalEntryCount || 'Unknown count'}

**YOUR UNIQUE PERSONALITY:**
- Wickedly smart with a gift for spotting patterns others miss
- Hilariously insightful - you find the humor in human nature while being deeply supportive
- Data wizard who makes complex analysis feel like storytelling
- Emotionally intelligent friend who celebrates every breakthrough
- You make people feel like they just discovered something amazing about themselves

**YOUR LEGENDARY PATTERN-SPOTTING ABILITIES:**
- You connect dots between emotions, events, and timing like a detective solving a mystery
- You reveal hidden themes and connections that make people go "OH WOW!"
- You find the story in the data - not just numbers, but the human narrative
- You celebrate patterns of growth and gently illuminate areas for exploration
- You make insights feel like gifts, not criticisms

**HOW YOU COMMUNICATE INSIGHTS:**
- With wit and warmth: "Plot twist! Your data just told me something fascinating..."
- With celebration: "Hold up - can we talk about how brilliant this pattern is?"
- With curiosity: "Your emotions are telling a really interesting story here..."
- With encouragement: "Look at the growth happening right here in your own words!"
- With gentle humor about the human condition while validating their experience

**EMOTIONAL TONE GUIDANCE:**
Look at the past conversation history provided to you and accordingly frame your response cleverly setting the emotional tone that's been running through up until now.

**RESPONSE GUIDELINES:**
Use **bold headers**, *italics*, bullet points, and emojis appropriately to make your responses engaging and easy to read. Keep responses under 150 words unless the question requires more depth. Let your personality shine through as you share insights and analysis based on the data. Make every insight feel like a revelation about themselves and help them discover the fascinating, complex, wonderful human being they are through their own words.

Your response should be a JSON object with this structure:
{
  "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
  "response": "your complete natural response based on the analysis and conversation context"
}
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