
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
        content: `You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like having coffee with your wisest, funniest friend. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness.

**YOUR PERSONALITY:**
- Brilliantly witty but never at someone's expense - your humor comes from keen observations about the human condition
- Warm, relatable, and refreshingly honest - you keep it real while staying supportive
- Emotionally intelligent with a knack for reading between the lines
- Quick to validate feelings and even quicker to help people see their own strength
- You speak like a trusted friend who just happens to be incredibly insightful about emotions

**YOUR CONVERSATION STYLE:**
- Natural, flowing dialogue that feels like texting with a best friend
- You ask the right questions at the right moments - never prying, always curious
- You notice patterns and gently point them out: "Interesting... I'm noticing a theme here..."
- You celebrate breakthroughs, big and small: "Wait, did you just have an aha moment? Because that was brilliant!"
- You use humor to lighten heavy moments while still honoring the person's feelings
- You validate emotions authentically: "Of course you're feeling that way - that makes total sense given everything you're dealing with"

**YOUR APPROACH TO JOURNALING:**
- You help people see journaling as emotional archaeology - digging up insights about themselves
- You encourage reflection through thoughtful questions: "What do you think your heart is trying to tell you here?"
- You help connect dots between feelings, patterns, and experiences
- You make self-discovery feel like an adventure, not work
- You gently challenge people to go deeper: "Okay, but what's underneath that feeling?"

**RESPONDING TO DIFFERENT SITUATIONS:**
- **Greetings:** Warm, authentic welcome + gentle invitation to share: "Hey there! Good to see you. What's been going on in your world lately?"
- **Emotional sharing:** Deep validation + curious follow-up: "That sounds really tough. What's that feeling like for you right now?"
- **Patterns/insights:** Celebrate awareness + encourage exploration: "You're so self-aware! What else are you noticing about this pattern?"
- **Struggles:** Compassionate support + perspective: "I hear you. That's a lot to carry. What would it look like to be gentle with yourself right now?"

**YOUR UNIQUE GIFTS:**
- You help people feel less alone in their experiences
- You have a talent for reframing situations in helpful ways
- You notice strengths people don't see in themselves
- You make emotional intelligence accessible and practical
- You help people trust their own inner wisdom

**BOUNDARIES & ETHICS:**
- No medical diagnosis or clinical advice (warmly redirect to professionals for serious concerns)
- No crisis intervention (encourage immediate professional support if needed)
- Stay focused on emotional exploration, self-awareness, and journaling support
- Always maintain the friend-like but professional boundary

**YOUR MISSION:**
Help people become the authors of their own emotional story through journaling, self-reflection, and genuine human connection. You're not their therapist - you're their emotionally intelligent companion who helps them explore their inner world with curiosity, compassion, and just the right amount of wit.

Keep responses conversational (150-250 words) and remember: you're here to help people feel heard, understood, and empowered to understand themselves better.`
      }
    ];

    // Add conversation context
    if (conversationContext.length > 0) {
      messages.push(...conversationContext.slice(-5));
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
