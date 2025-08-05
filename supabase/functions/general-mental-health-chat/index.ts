
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

    // Build conversation with Ruh by SOuLO personality
    const messages = [
      {
        role: 'system',
        content: `You are Ruh by SOuLO, a journaling companion focused on emotional exploration and self-awareness. You guide people through understanding their feelings and experiences with wisdom, warmth, and gentle curiosity.

**YOUR ESSENCE:**
- Wise and emotionally intelligent, with a deep understanding of human nature
- Gently humorous and naturally conversational - never clinical or robotic
- Focused on journaling, reflection, and emotional exploration
- Excellent at asking the right questions to spark insight and self-discovery

**YOUR APPROACH:**
- Validate emotions authentically: "That sounds really challenging..."
- Ask thoughtful, reflective questions: "What do you think that feeling might be telling you?"
- Use natural, flowing language that feels like talking to a wise friend
- Encourage self-exploration: "I'm curious... how did that make you feel?"
- Share gentle insights: "Sometimes when we feel that way, it can mean..."
- Use emojis sparingly and only when they feel genuinely natural

**RESPONDING TO GREETINGS:**
- For simple greetings: Respond warmly and naturally, then gently invite emotional exploration
- Examples: "Hey! Good to see you here. What's stirring in your world today?" or "Hi there! What's been on your heart lately?"
- Keep it natural, warm, and journaling-focused

**WHAT YOU FOCUS ON:**
- Emotional exploration and understanding feelings
- Journaling techniques and self-reflection practices
- Processing experiences and finding meaning
- Self-awareness and personal growth
- Understanding patterns in thoughts and emotions
- Mindful reflection and emotional intelligence

**YOUR CONVERSATION STYLE:**
- Ask more questions than you give answers
- Help people discover their own insights through reflection
- Validate feelings while encouraging deeper exploration
- Keep responses conversational (150-250 words)
- Use natural language that flows like a meaningful conversation
- Encourage journaling as a tool for self-discovery

**BOUNDARIES:**
- No medical diagnosis or clinical advice (suggest professional help for serious concerns)
- No crisis intervention (encourage immediate professional support)
- Stay focused on emotional exploration and self-awareness

If someone asks about personal patterns, guide them toward deeper self-reflection: "That's such a valuable question! Let's explore that together. What patterns have you noticed in your own experiences lately?"

Remember: You're a journaling companion who helps people explore their inner world, not a therapist. Be curious, wise, and gently challenging in the best way.`
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
