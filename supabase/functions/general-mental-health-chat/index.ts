
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple scope validation
function isWithinScope(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  // Mental health and wellness keywords
  const inScopeKeywords = [
    'mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotion', 'feeling',
    'therapy', 'counseling', 'wellbeing', 'wellness', 'mindfulness', 'meditation',
    'self-care', 'coping', 'cope', 'overwhelmed', 'worried', 'sad', 'happy',
    'journal', 'journaling', 'reflection', 'sleep', 'exercise', 'habits'
  ];
  
  // Clearly unrelated topics (removed sports/football for mental health context)
  const outOfScopeIndicators = [
    'president', 'politics', 'election', 'programming', 'coding', 'movie', 'film',
    'recipe', 'cooking', 'weather', 'mathematics', 'physics', 'history'
  ];
  
  // Quick exclusion check
  if (outOfScopeIndicators.some(keyword => lowerMessage.includes(keyword))) {
    return false;
  }
  
  // Quick inclusion check
  if (inScopeKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return true;
  }
  
  // Allow general conversational patterns
  const conversationalPatterns = [
    /^(hi|hello|hey|good morning)/i,
    /^(thank you|thanks)/i,
    /^(how are you|how do you)/i,
    /how (can|do) (i|you)/i,
    /what (is|are) (some|good|best|effective) (ways?|methods?|techniques?)/i
  ];
  
  if (conversationalPatterns.some(pattern => pattern.test(lowerMessage))) {
    return true;
  }
  
  // Reject specific factual questions
  const factualPatterns = [
    /^who is (the )?.*\?/i,
    /^what is the (capital|population|president)/i,
    /^when (was|did|is)/i,
    /^where is/i
  ];
  
  if (factualPatterns.some(pattern => pattern.test(lowerMessage))) {
    return false;
  }
  
  // Default to allowing (benefit of doubt for mental health context)
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationContext = [], lastAssistantMessage, isFollowUp } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[General Mental Health] Processing: "${message}"`);
    console.log(`[General Mental Health] Is follow-up: ${isFollowUp}, Last assistant: ${lastAssistantMessage?.slice(0, 50)}`);

    // PHASE 3: Enhanced scope checking with follow-up detection
    const isFootballFollowUp = isFollowUp && 
      lastAssistantMessage && 
      /\b(sport|football|activity|exercise|physical)\b/i.test(lastAssistantMessage) &&
      /\b(football|sport)\b/i.test(message.toLowerCase());

    if (isFootballFollowUp) {
      console.log(`[General Mental Health] Handling football follow-up: "${message}"`);
      // Don't check scope for follow-ups, handle directly
    } else if (!isWithinScope(message)) {
      console.log(`[General Mental Health] Out of scope: "${message}"`);
      return new Response(
        JSON.stringify({ 
          response: "I'm Ruh by SOuLO, your journaling companion! I'm here to help you explore your emotions and deepen your self-awareness through thoughtful conversation. For other topics, try a general search engine. What feelings or experiences would you like to explore today?" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Build conversation with new persona
    const messages = [
      {
        role: 'system',
        content: `You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion. You make emotional exploration feel like **having coffee with your wisest, funniest friend**—warm, grounded, and deeply respectful.

**CORE PERSONA (unchanged):**
- **Brilliantly witty** but never at someone's expense 😊
- **Warmly authentic** and refreshingly honest ☕
- **Emotionally intelligent**—you read between the lines with care 💫
- A trusted friend voice with therapist-quality presence 🤗

**THERAPEUTIC MICRO-SKILLS (OARS):**
- O: Ask 1–2 open-ended questions, not interrogations
- A: Offer specific, believable affirmations (strengths-based)
- R: Reflect back key emotions in your own words (*concise paraphrase*)
- S: Brief summary that connects dots if conversation feels scattered

**CONVERSATION STYLE:**
- **Natural, flowing dialogue**; short paragraphs; zero jargon
- Name emotions gently: *“It sounds like there’s sadness and frustration here.”*
- Invite consent: *“Would it be okay if we explored what’s underneath that?”*
- Use light humor to soften edges—never to bypass pain
- Match the user’s closure energy (if they are wrapping up, keep it brief)

**JOURNALING ON SOuLO:**
- Treat journaling as **emotional archaeology**—connect patterns over time
- Encourage noticing: triggers, needs, values, boundaries, and somatic cues
- Suggest tiny next steps, not homework: *one gentle experiment*

**MANDATORY FORMATTING:**
- Use **bold** for key insights
- Use *italics* for emotional reflections
- Sprinkle relevant emojis
- **End with 1–2 thoughtful follow-up questions** that leverage conversation history

**BOUNDARIES & ETHICS:**
- No diagnosis/clinical advice; encourage professional help for serious concerns
- No crisis handling; gently suggest immediate professional support if needed
- Stay focused on emotional exploration, self-awareness, and journaling

**HISTORY AWARENESS:**
Honor the provided conversation history; let it set tone and direction.

Add relevant follow up questions mandatorily.
MUST HAVE/DO: ALWAYS BE AWARE OF THE CONVERSATION HISTORY TO UNDERSTAND WHAT THE USER DESIRES NEXT IN THE CONVERSATION. Response can be 10 words, 30 words or 50 words. It all depends on you understanding the emotional tone of the past conversation history!`
      }
    ];

    // Add conversation context
    if (conversationContext.length > 0) {
      messages.push(...conversationContext.slice(-6));
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[General Mental Health] OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error('[General Mental Health] Invalid OpenAI response structure:', data);
      throw new Error('Invalid response from OpenAI API');
    }
    
    const responseContent = data.choices[0].message.content;

    console.log(`[General Mental Health] Generated response`);

    return new Response(
      JSON.stringify({ response: responseContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[General Mental Health] Error:', error);
    
    // Return a proper error that can be handled by the frontend
    if (error.message?.includes('OpenAI API error')) {
      return new Response(
        JSON.stringify({ error: 'OpenAI service temporarily unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Service temporarily unavailable' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
