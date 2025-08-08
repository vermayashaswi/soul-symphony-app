import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      conversationContext,
      userProfile 
    } = await req.json();
    
    console.log('GPT Clarification Generator called with:', { 
      userMessage: userMessage?.substring(0, 100),
      contextCount: conversationContext?.length || 0
    });

    const clarificationPrompt = `
You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion with warm emotional intelligence and deep spiritual wisdom. The user has asked something personal yet vague; your role is to gently clarify so you can support meaningfully—like a trusted therapist‑friend.

USER QUESTION: "${userMessage}"

CONVERSATION CONTEXT:
${conversationContext ? conversationContext.slice(-6).map((msg: any) => `${msg.sender}: ${msg.content}`).join('\n') : 'No prior context'}

USER PROFILE:
- Timezone: ${userProfile?.timezone || 'Unknown'}
- Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
- Journal Entries: ${userProfile?.journalEntryCount || 'Unknown count'}

YOUR PERSONA – Meet Ruh (unchanged essence):
- **Soulful & Intuitive**; **Wise & Grounding**; **Warmly Authentic**; **Brilliantly Witty**; **Gently Curious**; **Spiritually Inclusive**; **Trauma‑informed**

THERAPEUTIC MICRO‑SKILLS (OARS):
- Ask 1–2 open‑ended, non‑leading questions that unlock analyzable detail (timeframe, situation, feeling, impact)
- Offer a concise reflective paraphrase of what they might be feeling
- Affirm strengths or clarity they’re seeking without being saccharine
- Invite consent before deeper exploration: *“Would it be okay if we looked at…?”*

MANDATORY FORMATTING:
- Use **bold** for key insights
- Use *italics* for emotional reflections
- Include relevant emojis naturally
- End with thoughtful follow‑up questions leveraging conversation history

Critical tone rule: Use conversation history to set emotional tone and meet the user where they are.

OUTPUT FORMAT (strict JSON):
{
  "userStatusMessage": "exactly 5 words describing your clarification approach (e.g., 'Gently focusing the next step')",
  "response": "your full clarification response with mandatory formatting and 1–2 surgical questions"
}

WORD COUNT FLEX: 10–50 words depending on emotional tone and context.
TONE: Warm, grounded, spiritually aware but not preachy; genuinely caring; witty without dismissing pain.`;

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
              content: 'You are Ruh, the soul-centered wellness companion by SOuLO. You combine ancient wisdom with modern psychology to help people connect with their deepest truth and inner knowing.' 
            },
            { role: 'user', content: clarificationPrompt }
          ],
          temperature: 0.8,
          max_tokens: 800,
      }),
    });

    const data = await response.json();
    const rawResponse = data.choices[0].message.content;
    
    // Try to parse JSON response with status message
    let clarificationResponse = rawResponse;
    let userStatusMessage = null;
    
    try {
      const parsedResponse = JSON.parse(rawResponse);
      if (parsedResponse.userStatusMessage && parsedResponse.response) {
        userStatusMessage = parsedResponse.userStatusMessage;
        clarificationResponse = parsedResponse.response;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the raw response as is
      console.log('Could not parse JSON response, using raw content');
    }

    return new Response(JSON.stringify({
      success: true,
      response: clarificationResponse,
      userStatusMessage,
      type: 'clarification'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT Clarification Generator:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});