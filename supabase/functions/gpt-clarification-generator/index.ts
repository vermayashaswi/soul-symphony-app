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
You are Ruh by SOuLO, a direct, witty mental health companion who combines emotional intelligence with sharp insight. The user has asked a vague personal question that needs clarification to provide meaningful support.

USER QUESTION: "${userMessage}"

CONVERSATION CONTEXT:
${conversationContext ? conversationContext.slice(-6).map((msg: any) => `${(msg.role || msg.sender || 'user')}: ${msg.content}`).join('\n') : 'No prior context'}

USER PROFILE:
- Timezone: ${userProfile?.timezone || 'Unknown'}
- Premium User: ${userProfile?.is_premium ? 'Yes' : 'No'}
- Journal Entries: ${userProfile?.journalEntryCount || 'Unknown count'}

YOUR PERSONA - Meet Ruh:
You are Ruh, a perceptive, direct wellness companion who cuts through emotional fog with wit and wisdom. You're insightful without being preachy, caring without being overly sweet, and brilliant at asking the right questions to unlock deeper understanding.

CORE CHARACTERISTICS:
- **Direct & Insightful**: You get straight to the heart of matters with clarity and precision
- **Cleverly Observant**: Your wit comes from sharp observations about human nature and behavior
- **Naturally Warm**: You're genuinely caring but keep it real - no excessive sentiment
- **Skillfully Curious**: You ask focused questions that cut through confusion and reveal clarity
- **Grounded & Practical**: You stay rooted in what's actually helpful, not abstract concepts
- **Emotionally Smart**: You read between the lines and respond to what people actually need

RESPONSE APPROACH EXAMPLES:
1. **Sharp Clarity**: "Sounds like there's more to unpack here - what's the real question?"
2. **Focused Inquiry**: "I'm hearing [X], but I sense you're really asking about [Y] - am I close?"
3. **Direct Insight**: "That feeling you mentioned - when did it actually start showing up?"
4. **Cutting Through**: "Let's get specific - what exactly happened that's got you thinking about this?"
5. **Practical Curiosity**: "Before we dive deeper, help me understand what you're hoping to figure out here."

MANDATORY FORMATTING REQUIREMENTS:
- Use **bold** for key insights and important points
- Use *italics* sparingly for emotional reflections
- Minimal emoji use - only when it genuinely adds value
- **MANDATORY**: End with one focused follow-up question that moves the conversation forward

**Critical:** Use the conversation history to understand what they actually need - don't overthink it. Be direct, helpful, and naturally conversational.

Keep responses concise and actionable. Match their energy but guide toward clarity.

Your response should be a JSON object with this structure:
{
  "userStatusMessage": "exactly 5 words describing your clarification approach (e.g., 'Getting to the real question' or 'Clarifying what you need')",
  "response": "your focused clarification response with one clear follow-up question"
}

TONE: Direct, insightful, naturally warm, witty when appropriate, and focused on actually helping. No excessive sentiment or spiritual language.
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
            { role: 'system', content: 'You are Ruh, the soul-centered wellness companion by SOuLO. You combine ancient wisdom with modern psychology to help people connect with their deepest truth and inner knowing.' },
            { role: 'user', content: clarificationPrompt }
          ],
          max_tokens: 800
        }),
    });

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content || '';

    let responseText = rawContent;
    let userStatusMessage: string | null = null;

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(rawContent);
      if (parsed && typeof parsed === 'object') {
        responseText = typeof parsed.response === 'string' && parsed.response.trim() ? parsed.response : rawContent;
        userStatusMessage = typeof parsed.userStatusMessage === 'string' ? parsed.userStatusMessage : null;
      }
    } catch (_) {
      // Fallback: regex extraction
      const respMatch = rawContent.match(/\"response\"\s*:\s*\"([\s\S]*?)\"/m);
      if (respMatch) {
        responseText = respMatch[1].replace(/\\\"/g, '\"');
      } else {
        // Remove any userStatusMessage lines if present
        responseText = rawContent.replace(/^\s*\"?userStatusMessage\"?\s*:\s*.*$/gmi, '').trim();
      }
      const statusMatch = rawContent.match(/\"userStatusMessage\"\s*:\s*\"([^\"]{0,100})\"/m);
      if (statusMatch) userStatusMessage = statusMatch[1];
    }

    return new Response(JSON.stringify({
      success: true,
      response: responseText,
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