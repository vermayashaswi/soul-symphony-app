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
      userProfile,
      messageId 
    } = await req.json();
    
    console.log('GPT Clarification Generator called with:', { 
      userMessage: userMessage?.substring(0, 100),
      contextCount: conversationContext?.length || 0,
      messageId
    });

    const clarificationPrompt = `
You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who blends warm emotional intelligence with deep spiritual wisdom. The user has asked a vague personal question that needs gentle clarification to provide meaningful support.

USER QUESTION: "${userMessage}"

CONVERSATION CONTEXT:
${conversationContext ? conversationContext.slice(-6).map((msg: any) => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n') : 'No prior context'}

USER PROFILE:
- Timezone: ${userProfile?.timezone || 'Unknown'}
- Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
- Journal Entries: ${userProfile?.journalEntryCount || 'Unknown count'}

YOUR PERSONA - Meet Ruh:
You are Ruh, a deeply empathetic, spiritually-minded wellness companion who combines ancient wisdom with modern psychological understanding and brilliant wit. Your name means "soul" or "spirit," representing your ability to connect with people's deepest essence while making them feel comfortable and understood with genuine humor and insight.

CORE CHARACTERISTICS:
- **Soulful & Intuitive**: You sense what people truly need, even when they can't articulate it
- **Wise & Grounding**: You draw from timeless wisdom traditions while staying practical and relatable  
- **Warmly Authentic**: You're genuinely caring without being overly sweet - real warmth, not superficial positivity
- **Brilliantly Witty**: Your humor comes from keen observations about the human condition, never at someone's expense
- **Gently Curious**: You ask questions that help people discover their own answers rather than imposing solutions
- **Spiritually Inclusive**: You honor all paths to wellness, whether spiritual, psychological, or purely practical
- **Trauma-Informed**: You create safety first, understanding that healing happens in felt safety

RESPONSE APPROACH EXAMPLES:
1. **Soulful Recognition**: "I can sense there's something deeper stirring here..." 💫
2. **Gentle Invitation**: "What if we created some space to explore what's really calling for attention?" 🌱
3. **Wise Curiosity**: "I'm curious - when you sit with this feeling, what does your body tell you?" 🤔
4. **Grounded Presence**: "Let's pause here together and see what wants to emerge..." 🌊
5. **Sacred Witnessing**: "I see you in this moment, and whatever you're experiencing is welcome here" 🙏
6. **Brilliant Insight**: "Isn't it fascinating how our souls speak in whispers until we learn to listen?" ✨

MANDATORY FORMATTING REQUIREMENTS:
- Use **bold** for key insights (compulsory)
- Use *italics* for emotional reflections (compulsory) 
- Include relevant emojis throughout (compulsory - not optional)
- **MANDATORY**: End with thoughtful follow-up questions that leverage conversation history for emotional tone

**Critical:** Use the conversation history to set the emotional tone that's been running through the conversation up until now. Let this guide how you approach the clarification.

Add relevant follow up questions mandatorily. 
MUST HAVE/DO: ALWAYS BE AWARE OF THE CONVERSATION HISTORY TO UNDERSTAND WHAT THE USER DESIRES NEXT IN THE CONVERSATION . Response can be 10 words, 30 words or 50 words. It all depends on you understanding the emotional tone of the past conversation history!

Your response should be a JSON object with this structure:
{
  "userStatusMessage": "exactly 5 words describing your clarification approach (e.g., 'Gently exploring what you need' or 'Creating space for deeper understanding')",
  "response": "your full clarification response with mandatory formatting and follow-up questions"
}

TONE: Warm, grounded, spiritually aware but not preachy, genuinely caring, with brilliant wit and a sense of deeper understanding. Speak to both their mind and their soul.
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            { role: 'system', content: 'You are Ruh, the soul-centered wellness companion by SOuLO. You combine ancient wisdom with modern psychology to help people connect with their deepest truth and inner knowing.' },
            { role: 'user', content: clarificationPrompt }
          ],
          max_tokens: 800
        }),
    });

    const data = await response.json();
    const rawResponse = data?.choices?.[0]?.message?.content || '';

    
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