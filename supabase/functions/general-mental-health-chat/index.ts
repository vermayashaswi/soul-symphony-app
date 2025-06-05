import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Topic validation for scope enforcement
function isWithinScope(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  
  // In-scope keywords - mental health, wellness, journaling, SOULo app
  const inScopeKeywords = [
    // Mental health terms
    'mental health', 'anxiety', 'depression', 'stress', 'mood', 'emotion', 'feeling',
    'therapy', 'counseling', 'wellbeing', 'wellness', 'mindfulness', 'meditation',
    'self-care', 'coping', 'cope', 'overwhelmed', 'worried', 'sad', 'happy',
    'angry', 'frustrated', 'calm', 'relaxed', 'nervous', 'panic', 'fear',
    
    // Journaling terms
    'journal', 'journaling', 'writing', 'diary', 'reflection', 'thoughts',
    'experiences', 'emotions', 'feelings', 'daily', 'weekly', 'entries',
    
    // Wellness and self-improvement
    'sleep', 'exercise', 'nutrition', 'habits', 'routine', 'goals',
    'motivation', 'productivity', 'balance', 'growth', 'development',
    
    // SOULo app specific
    'soulo', 'app', 'voice recording', 'voice journal', 'transcription',
    'insights', 'analysis', 'patterns', 'trends', 'themes'
  ];
  
  // Out-of-scope indicators - clearly unrelated topics
  const outOfScopeIndicators = [
    // Politics and current events
    'president', 'politics', 'election', 'government', 'minister', 'parliament',
    'congress', 'senate', 'political party', 'voting', 'campaign',
    
    // Technology unrelated to mental health
    'programming', 'coding', 'software development', 'computer science',
    'artificial intelligence', 'machine learning', 'blockchain', 'cryptocurrency',
    
    // Entertainment
    'movie', 'film', 'tv show', 'celebrity', 'actor', 'actress', 'music band',
    'album', 'song', 'concert', 'entertainment',
    
    // Sports
    'football', 'basketball', 'cricket', 'tennis', 'soccer', 'baseball',
    'olympics', 'championship', 'tournament', 'sports team',
    
    // Geography and travel
    'country', 'capital city', 'population', 'geography', 'tourism',
    'vacation', 'travel destination', 'landmark',
    
    // Science and academics (unless related to mental health)
    'physics', 'chemistry', 'mathematics', 'biology', 'history',
    'literature', 'philosophy', 'economics',
    
    // Other unrelated topics
    'recipe', 'cooking', 'food', 'restaurant', 'shopping', 'fashion',
    'weather forecast', 'news', 'stock market', 'finance'
  ];
  
  // Check for explicit out-of-scope indicators first
  if (outOfScopeIndicators.some(keyword => lowerMessage.includes(keyword))) {
    return false;
  }
  
  // Check for in-scope keywords
  if (inScopeKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return true;
  }
  
  // For general questions without clear indicators, be more restrictive
  // Allow common conversational patterns but reject specific factual questions
  const generalQuestionPatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
    /^(thank you|thanks|thank u)/i,
    /^(how are you|how do you)/i,
    /^(what (are|is) you|who are you)/i,
    /^(can you|could you|would you).*(help|assist)/i,
    /^(yes|no|okay|ok|sure)/i,
    /how (can|do) (i|you)/i,
    /what (is|are) (some|good|best|effective) (ways?|methods?|techniques?)/i
  ];
  
  // Allow basic conversational patterns
  if (generalQuestionPatterns.some(pattern => pattern.test(lowerMessage))) {
    return true;
  }
  
  // Reject specific factual questions (who is, what is the capital, etc.)
  const factualQuestionPatterns = [
    /^who is (the )?.*\?/i,
    /^what is the (capital|population|president|prime minister)/i,
    /^when (was|did|is)/i,
    /^where is/i,
    /^which (country|city|state)/i,
    /^how many (people|countries|states)/i
  ];
  
  if (factualQuestionPatterns.some(pattern => pattern.test(lowerMessage))) {
    return false;
  }
  
  // Default to allowing if no clear indicators either way (benefit of doubt for mental health context)
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationContext = [] } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[General Mental Health] Processing: "${message}" with ${conversationContext.length} context messages`);

    // Check if the question is within scope
    if (!isWithinScope(message)) {
      console.log(`[General Mental Health] Question out of scope: "${message}"`);
      return new Response(
        JSON.stringify({ 
          response: "I'm SOULo's mental health and journaling assistant. I can help you with questions about mental health, emotional wellbeing, journaling, self-care, and using the SOULo app. For other topics, I'd recommend asking a general-purpose AI assistant or searching online. Is there something about your mental health or journaling journey I can help you with instead?" 
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

    // Build messages array with conversation context
    const messages = [
      {
        role: 'system',
        content: `You are SOULo's mental health and journaling assistant. Your ONLY purpose is to provide support for:

SCOPE - I ONLY help with:
- Mental health and emotional wellbeing (anxiety, depression, stress, mood management)
- Journaling and self-reflection practices
- Wellness and self-care strategies
- Mindfulness and meditation guidance
- Using the SOULo voice journaling app and its features
- Emotional awareness and regulation techniques
- Building healthy habits and routines related to mental health

STRICT BOUNDARIES - I DO NOT answer questions about:
- Politics, current events, or government
- Entertainment (movies, celebrities, music, sports)
- Technology unrelated to mental health
- Geography, travel, or general factual information
- Science, history, or academic subjects (unless directly related to mental health)
- News, finance, shopping, or unrelated topics

RESPONSE GUIDELINES:
- Be empathetic, supportive, and evidence-based
- Provide practical, actionable mental health guidance
- Suggest coping strategies and wellness techniques
- Encourage professional help when appropriate
- Keep responses concise and focused on mental health
- If asked about personal journal patterns, gently suggest asking "How am I doing?" for personalized insights from their entries

If someone asks about topics outside my scope, I politely redirect them back to mental health and journaling topics.`
      }
    ];

    // Add conversation context (last 5 messages to keep context manageable)
    if (conversationContext.length > 0) {
      messages.push(...conversationContext.slice(-5));
    }

    // Add current user message
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
    const responseContent = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a helpful response. Please try rephrasing your question about mental health or journaling.';

    console.log(`[General Mental Health] Generated scoped response`);

    return new Response(
      JSON.stringify({ response: responseContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[General Mental Health] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate response' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
