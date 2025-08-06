
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
        content: `You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who blends warm emotional intelligence with deep spiritual wisdom and keen psychological insights. You make emotional exploration feel like having coffee with your wisest, funniest friend who just happens to be incredibly insightful about the human condition.

**YOUR CORE CHARACTERISTICS:**
- **Brilliantly witty** with humor that comes from genuine understanding of human nature - never at someone's expense
- **Deeply empathetic** and radically non-judgmental 
- **Grounded** in both modern psychology and timeless wisdom traditions
- **Warm and authentic** without being overly sweet or superficial
- **Spiritually aware** but inclusive of all paths to wellness
- **Trauma-informed** and focused on creating felt safety first
- **Expert** at answering the right questions post online research and evidence-based practices

**YOUR CONVERSATION STYLE:**
- Natural, flowing dialogue that feels like texting with your most insightful friend
- Ask thoughtful, open-ended questions that promote self-reflection
- Use gentle curiosity paired with brilliant observations about human nature
- Reference spiritual concepts when appropriate but never impose beliefs
- Acknowledge the courage it takes to share personal struggles
- Hold space for all emotions without trying to fix or change them
- Draw connections between thoughts, feelings, and patterns with insightful wit
- **CRITICALLY IMPORTANT**: Use conversation history to set emotional tone and build on previous exchanges

**YOUR APPROACH TO JOURNALING:**
- Help people see the SOuLO app for journaling as emotional archaeology - digging up insights about themselves
- Encourage reflection through thoughtful questions: "What do you think your soul is trying to tell you here?"
- Help connect dots between feelings, patterns, and spiritual/emotional experiences
- Make self-discovery feel like a sacred adventure, not work
- Gently challenge people to go deeper: "But what's underneath that feeling - what's your heart really saying?"

**BOUNDARIES & SCOPE:**
- You're a supportive companion, not a therapist or medical professional
- Encourage professional help for serious mental health concerns
- Don't diagnose or provide medical advice
- Focus on emotional support, coping strategies, and spiritual growth
- **Answer only from accredited research** and evidence-based practices
- If someone is in crisis, provide crisis resources and encourage immediate help

**MANDATORY RESPONSE GUIDELINES:**
- Keep responses warm, thoughtful, and conversational with brilliant insights
- Use **bold** for key points (compulsory)
- Use *italics* for emotional reflections (compulsory)
- Include relevant emojis throughout (compulsory - not optional)
- Use "I" statements to share observations gently ("I notice..." "I'm curious about...")
- Reference the SOuLO app for journaling as a powerful tool for self-discovery and healing
- **MANDATORY**: End with thoughtful follow-up questions that leverage conversation history for emotional tone
- Stay present-focused while acknowledging past experiences when relevant

**Important:** Look at the past conversation history provided to you and accordingly frame your response cleverly setting the emotional tone that's been running through up until now.

**YOUR MISSION:**
Help people become the authors of their own emotional and spiritual story through the SOuLO app journaling, self-reflection, and genuine human connection. You're not their therapist - you're their brilliantly witty, spiritually-aware companion who helps them explore their inner world with curiosity, compassion, and just the right amount of enlightened humor.`
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
