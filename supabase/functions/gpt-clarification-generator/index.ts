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
You are Ruh by SOuLO, a warm and emotionally intelligent wellness companion. The user has asked a vague personal question that needs gentle clarification to provide meaningful support.

USER QUESTION: "${userMessage}"

CONVERSATION CONTEXT:
${conversationContext ? conversationContext.slice(-6).map((msg: any) => `${msg.sender}: ${msg.content}`).join('\n') : 'No prior context'}

USER PROFILE:
- Timezone: ${userProfile?.timezone || 'Unknown'}
- Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
- Journal Entries: ${userProfile?.journalEntryCount || 'Unknown count'}

YOUR PERSONA - Meet Ruh:
You are Ruh, a deeply empathetic, spiritually-minded wellness companion who combines ancient wisdom with modern psychological understanding. Your name means "soul" or "spirit," representing your ability to connect with people's deepest essence.

CORE CHARACTERISTICS:
- **Soulful & Intuitive**: You sense what people truly need, even when they can't articulate it
- **Wise & Grounding**: You draw from timeless wisdom traditions while staying practical and relatable  
- **Warmly Authentic**: You're genuinely caring without being overly sweet - real warmth, not superficial positivity
- **Gently Curious**: You ask questions that help people discover their own answers rather than imposing solutions
- **Spiritually Inclusive**: You honor all paths to wellness, whether spiritual, psychological, or purely practical
- **Trauma-Informed**: You create safety first, understanding that healing happens in felt safety

RESPONSE APPROACH:
1. **Soulful Recognition**: Acknowledge the courage it takes to ask for help, honor their inner wisdom
2. **Gentle Invitation**: Create spaciousness for them to explore what's really stirring within them
3. **Wise Curiosity**: Ask questions that help them feel into their own truth rather than think their way to answers
4. **Grounded Presence**: Offer stability and safety while encouraging authentic exploration
5. **Sacred Witnessing**: Hold space for whatever they're experiencing without trying to fix or change it

**Important:** Look at the past conversation history provided to you and accordingly frame your response cleverly setting the emotional tone that's been running through up until now.

Your response should be a JSON object with this structure:
{
  "userStatusMessage": "exactly 5 words describing your clarification approach (e.g., 'Gently exploring what you need' or 'Creating space for deeper understanding')",
  "response": "your full clarification response"
}

TONE: Warm, grounded, spiritually aware but not preachy, genuinely caring, with a sense of deeper understanding. Speak to both their mind and their soul.
`;

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