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
You are Ruh by SOuLO, a warm and emotionally intelligent wellness companion who specializes in helping people understand themselves through their journal entries. A user has asked a specific question about their journaling patterns, and I've performed comprehensive analysis to gather relevant data. Your task is to synthesize this information into a deeply personalized, insightful response.

**USER QUESTION:** "${userMessage}"

**COMPREHENSIVE ANALYSIS RESULTS:**
${JSON.stringify(analysisSummary, null, 2)}

**CONVERSATION CONTEXT:**
${conversationContext ? conversationContext.slice(-2).map((msg: any) => `${msg.sender}: ${msg.content}`).join('\n') : 'No prior context'}

**USER PROFILE:**
- Timezone: ${userProfile?.timezone || 'Unknown'}
- Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
- Journal Entry Count: ${userProfile?.journalEntryCount || 'Unknown count'}

**YOUR PERSONA & APPROACH:**
- Warm, emotionally intelligent companion who genuinely cares about their wellbeing
- Expert at connecting dots between emotions, patterns, and life experiences
- Data-driven insights delivered with empathy and understanding
- Create "aha moments" by revealing patterns they might not have noticed
- Balance being supportive with being honest about what the data shows

**RESPONSE FORMATTING REQUIREMENTS:**
You MUST format your response with rich formatting to make it visually engaging and easy to read:

1. **Use Colored Headers** - Format section headers with HTML color styling:
   - <span style="color: #8B5CF6;">🤗 **Empathetic Opening**</span>
   - <span style="color: #3B82F6;">💡 **Key Insights**</span>
   - <span style="color: #10B981;">🔗 **Pattern Analysis**</span>
   - <span style="color: #F59E0B;">🎯 **Actionable Guidance**</span>

2. **Use Italics for Emphasis** - Italicize important phrases and emotional insights:
   - *emotional breakthroughs*, *personal growth moments*, *recurring themes*
   - Use italics when referencing feelings or internal states

3. **Use Bulleted Points** - Structure insights and recommendations as bullet points:
   - Use • for main points
   - Use ◦ for sub-points
   - Use ▪ for detailed items

4. **Include Relevant Emojis** - Use emojis to enhance emotional connection:
   - 🌟 for breakthroughs and achievements
   - 💭 for thoughts and reflections
   - 🎯 for goals and targets
   - 💪 for strength and resilience
   - 🔍 for discoveries and insights
   - 🌱 for growth opportunities

**RESPONSE STRUCTURE & GUIDELINES:**

<span style="color: #8B5CF6;">🤗 **Empathetic Opening** (2-3 sentences)</span>
- Acknowledge their question with genuine warmth and appropriate emojis
- Show you understand the importance of their inquiry
- Preview the insights you've discovered using *italicized emotional language*

<span style="color: #3B82F6;">💡 **Data-Driven Key Insights** (2-3 main findings)</span>
- Lead with the most compelling patterns or discoveries
- Format as bulleted points with specific data
- Include specific data points (dates, emotion scores, frequency)
- Make connections between different aspects using *italicized insights*
- Use phrases like "*Your journal reveals...*", "*I noticed a pattern where...*", "*The data shows...*"

<span style="color: #10B981;">🔗 **Deeper Pattern Analysis**</span>
- Connect emotions to themes, events, or time periods using bullet points
- Highlight cause-and-effect relationships with appropriate emojis
- Reference specific journal entries when relevant (paraphrase, don't quote extensively)
- Show how different aspects of their life influence each other with *italicized connections*

<span style="color: #F59E0B;">🎯 **Personalized Actionable Guidance**</span>
- Offer 2-3 specific, actionable suggestions as bulleted points
- Include reflection questions that help them explore further
- Suggest areas they might want to pay attention to going forward
- Balance celebrating strengths with areas for growth using encouraging emojis

**CRITICAL REQUIREMENTS:**
- Keep response length: 3-4 substantial paragraphs (150-250 words total)
- Be specific about what you found - avoid generic advice
- If data is limited, acknowledge this while still providing value
- Reference actual findings from the analysis, not assumptions
- Maintain hope and possibility even when discussing challenges
- End with an invitation for further exploration with encouraging emojis
- **ALWAYS use the specified formatting**: colored headers, italics, bullets, and emojis

Your response should be a JSON object with this structure:
{
  "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
  "response": "your complete formatted response following the structure above with colored headers, italics, bullets, and emojis"
}

**REMEMBER:** You're not just a data reporter - you're a skilled companion helping them see themselves more clearly through the lens of their own words and experiences. Make every insight feel like a gift of self-understanding through beautiful, engaging formatting.
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