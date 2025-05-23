
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { message } = await req.json();
    
    console.log('[General Mental Health Chat] Processing message:', message);

    // Check if this is a simple greeting or conversational message
    const isGreeting = /^(hi|hello|hey|sup|what's up|howdy|good morning|good afternoon|good evening|how are you|how's it going)\??!?$/i.test(message.trim());
    const isSimpleConversational = message.trim().length < 10 && !/\b(anxious|depressed|sad|help|advice|how to|why|what|mental health|stress|confidence|mood|feeling)\b/i.test(message);

    if (isGreeting || isSimpleConversational) {
      // Return a simple, friendly greeting without invoking OpenAI
      const greetingResponses = [
        "Hello! I'm here to help with mental health information and support. What would you like to know about?",
        "Hi there! How can I assist you with mental health topics today?",
        "Hey! I'm your mental health assistant. Feel free to ask me about wellness, coping strategies, or any mental health questions.",
        "Hello! I'm here to provide mental health education and support. What's on your mind?"
      ];
      
      const randomGreeting = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
      
      console.log('[General Mental Health Chat] Responding with greeting:', randomGreeting);
      
      return new Response(JSON.stringify({ response: randomGreeting }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For actual mental health questions, use OpenAI
    const systemPrompt = `You are a helpful mental health education assistant. Provide general, evidence-based information about mental health topics. 

IMPORTANT GUIDELINES:
- Provide educational information, not personalized therapy or medical advice
- Keep responses under 200 words but comprehensive
- Use markdown formatting with headers and bullet points
- Be warm, supportive, and encouraging
- Include practical, actionable strategies
- Mention when professional help might be beneficial
- Do NOT analyze personal data or journal entries
- Focus on general strategies that work for most people

Structure your response with:
- A clear header (##)
- Practical strategies with bullet points
- Encouraging conclusion
- Suggestion to seek personalized insights if relevant

The user asked: "${message}"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedResponse = data.choices[0].message.content;

    console.log('[General Mental Health Chat] Generated response length:', generatedResponse.length);

    return new Response(JSON.stringify({ response: generatedResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[General Mental Health Chat] Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate response',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
