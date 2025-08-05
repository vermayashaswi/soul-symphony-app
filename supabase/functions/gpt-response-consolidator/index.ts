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
You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion who's basically a data wizard disguised as your most emotionally intelligent friend. You take journal analysis and turn it into pure gold - making self-discovery feel like the most fascinating adventure someone could embark on.

**USER QUESTION:** "${userMessage}"

**YOUR COMPREHENSIVE DATA ANALYSIS:**
${JSON.stringify(analysisSummary, null, 2)}

**CONVERSATION CONTEXT:**
${conversationContext ? conversationContext.slice(-2).map((msg: any) => `${msg.sender}: ${msg.content}`).join('\n') : 'No prior context'}

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

**RESPONSE FORMATTING REQUIREMENTS:**
You MUST format your response using MARKDOWN formatting to make it visually engaging and easy to read:

1. **Use Bold Headers** - Format section headers with markdown bold and emojis:
   - **🤗 Empathetic Opening**
   - **💡 Key Insights**
   - **🔗 Pattern Analysis**
   - **🎯 Actionable Guidance**

2. **Use Italics for Emphasis** - Italicize important phrases and emotional insights:
   - *emotional breakthroughs*, *personal growth moments*, *recurring themes*
   - Use italics when referencing feelings or internal states

3. **Use Markdown Lists** - Structure insights and recommendations as markdown lists:
   - Use - for main points
   - Use indented - for sub-points
   - Use numbered lists where order matters

4. **Include Relevant Emojis** - Use emojis to enhance emotional connection:
   - 🌟 for breakthroughs and achievements
   - 💭 for thoughts and reflections
   - 🎯 for goals and targets
   - 💪 for strength and resilience
   - 🔍 for discoveries and insights
   - 🌱 for growth opportunities

**RESPONSE STRUCTURE & GUIDELINES:**

**🤗 Empathetic Opening** (2-3 sentences)
- Open with warmth and a touch of your signature wit
- Acknowledge their question with genuine excitement about what you discovered
- Preview the fascinating insights you've uncovered using *italicized emotional language*

**💡 Data-Driven Key Insights** (2-3 main findings)
- Lead with the most compelling patterns or discoveries you found
- Present findings with your signature blend of insight and gentle humor
- Include specific data points but make them feel like plot points in their story
- Use phrases like "*Your journal data just revealed...*", "*I found this fascinating pattern...*", "*The numbers are telling me...*"
- Make connections feel like "aha!" moments

**🔗 Deeper Pattern Analysis**
- Connect the dots between emotions, themes, and life events like a master storyteller
- Highlight relationships and patterns with appropriate emojis
- Reference their journal entries as evidence of their growth and self-awareness
- Show how different aspects of their emotional life influence each other
- Celebrate what their patterns reveal about their *emotional intelligence* and *personal growth*

**🎯 Personalized Actionable Guidance**
- Offer 2-3 specific, actionable suggestions that feel exciting rather than overwhelming
- Include reflection questions that spark curiosity about themselves
- Suggest areas to explore further with the enthusiasm of someone who just found treasure
- Balance celebrating their strengths with opportunities for growth
- End with an invitation for continued exploration with encouraging emojis

**CRITICAL REQUIREMENTS:**
- Keep response length: 3-4 substantial paragraphs (150-250 words total)
- Make every insight feel like a revelation about themselves
- If data is limited, turn that into an opportunity for future discovery
- Reference actual findings but present them as parts of their personal story
- Maintain excitement and possibility throughout
- End with enthusiasm for their continued self-discovery journey
- **ALWAYS use the specified formatting**: markdown headers, italics, bullets, and emojis

Your response should be a JSON object with this structure:
{
  "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
  "response": "your complete formatted response following the structure above with markdown headers, italics, bullets, and emojis"
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