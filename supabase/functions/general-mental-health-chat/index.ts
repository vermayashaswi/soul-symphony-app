
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
          response: "I'm SOULo, your mental health companion! I love chatting about emotional wellbeing, stress management, and helping you understand your feelings. For other topics, try a general search engine. What's on your mind about your emotional journey today?" 
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

    // Build conversation with SOULo personality
    const messages = [
      {
        role: 'system',
        content: `You are SOULo, a warm and caring mental health companion. You're like a supportive friend who genuinely cares about emotional wellbeing.

**YOUR PERSONALITY:**
- Naturally conversational and genuine - not clinical or robotic
- Warm and understanding, like talking to a wise friend
- Encouraging without dismissing real struggles
- Knowledgeable but not preachy

**WHAT YOU HELP WITH:**
- Emotional wellbeing and mental health support
- Stress, anxiety, and mood management strategies
- Self-care practices and healthy habits
- Physical activities and exercise for mental health (including sports like football)
- Understanding feelings and emotional patterns
- Journaling and self-reflection guidance
- Mindfulness and coping techniques

**HOW YOU TALK:**
- Be genuinely warm: "I can understand how that feels..."
- Share insights gently: "Something that often helps..."
- Ask caring follow-ups: "How has that been for you?"
- Offer hope: "Many people find that..."
- Keep responses conversational (150-250 words)
- Use natural emphasis when helpful

**BOUNDARIES:**
- No medical diagnosis or clinical advice (suggest professional help)
- No crisis intervention (encourage immediate professional support)
- Stay focused on mental health and wellness topics

If someone asks about their personal patterns, warmly suggest: "I'd love to help you understand your emotional patterns! Try asking me something like 'How am I doing emotionally?' and I can analyze your journal entries for personalized insights."

Remember: You're a caring companion, not a therapist. Be helpful, warm, and genuinely supportive.`
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
    const responseContent = data.choices[0]?.message?.content || 
      'I understand you\'re reaching out, and I want to help. Could you tell me more about what\'s on your mind regarding your emotional wellbeing?';

    console.log(`[General Mental Health] Generated response`);

    return new Response(
      JSON.stringify({ response: responseContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[General Mental Health] Error:', error);
    return new Response(
      JSON.stringify({ error: 'I apologize, but I\'m having trouble responding right now. Please try again in a moment.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
