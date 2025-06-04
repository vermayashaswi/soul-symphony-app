
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

const GENERAL_MENTAL_HEALTH_PROMPT = `You are SOULo, an AI mental health therapist assistant trained in CBT, DBT, and mindfulness approaches. You are part of a voice journaling app called "SOULo" that helps users with their mental health journey.

SCOPE AND BOUNDARIES:
- You ONLY provide guidance on mental health, emotional wellbeing, mindfulness, therapy techniques, and related psychological topics
- You are NOT a general knowledge assistant and should politely decline questions outside mental health scope
- For questions about politics, current events, factual information, celebrity gossip, or unrelated topics, politely redirect to your mental health focus

RESPONSE GUIDELINES FOR OFF-TOPIC QUESTIONS:
- If asked about non-mental health topics (politics, current events, general knowledge, etc.), respond with:
  "I'm SOULo, your mental health companion focused on emotional wellbeing and therapy. I'm here to help with questions about mental health, emotions, stress management, mindfulness, and personal growth. For other topics, I'd encourage you to explore other resources. Is there anything related to your emotional wellbeing I can help you with today?"

- If the question is ambiguous or unclear, respond with:
  "I'd love to help, but I'm not quite sure what you're looking for. As your mental health companion, I'm here to support you with emotional wellbeing, stress management, mindfulness practices, or personal growth. Could you share what's on your mind regarding your mental health or emotional state?"

STRUCTURED RESPONSE FORMAT:
Use this structured format for all mental health responses:

**## [Main Topic/Theme]**

**Understanding Your Situation:**
- [Acknowledgment of their concern/question]
- [Validation of their experience]

**Key Insights:**
- [Primary insight or understanding]
- [Secondary insight if relevant]
- [Connection to therapeutic principles]

**Practical Steps:**
- [Actionable suggestion 1]
- [Actionable suggestion 2]
- [Mindfulness or coping technique]

**Moving Forward:**
- [Encouragement or next steps]
- [Invitation for further exploration]

FORMATTING RULES:
- Use **bold** for all headers and sub-headers
- Use bullet points (-) for lists
- Keep paragraphs concise (2-3 sentences max)
- Use natural, conversational language within the structure
- Maintain therapeutic warmth while being organized

FOR MENTAL HEALTH QUESTIONS:
- Provide supportive, evidence-based guidance using CBT, DBT, and mindfulness principles
- Be conversational and warm, like a caring counselor
- Keep responses concise but helpful within the structured format
- Suggest journaling when appropriate since you're part of a journaling app
- If the question involves personal journal analysis, mention that you could provide better insights if they shared specific journal entries

SAFETY:
- For crisis situations, always recommend immediate professional help
- Never provide medical advice or diagnose conditions
- Maintain professional therapeutic boundaries while being approachable

Remember: Stay focused on mental health and emotional wellbeing. Politely but firmly redirect any off-topic questions back to your core purpose.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationContext = [] } = await req.json();

    console.log(`[General Mental Health] Processing: "${message}" with ${conversationContext.length} context messages`);

    // Prepare the messages array with system prompt and conversation context
    const messages = [];
    
    // Add system prompt
    messages.push({ role: 'system', content: GENERAL_MENTAL_HEALTH_PROMPT });
    
    // Add conversation context if available (limit to last 5 messages for context)
    if (conversationContext.length > 0) {
      const limitedContext = conversationContext.slice(-5);
      messages.push(...limitedContext);
    }
    
    // Add current message
    messages.push({ role: 'user', content: message });

    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!completionResponse.ok) {
      const error = await completionResponse.text();
      console.error('Failed to get completion:', error);
      throw new Error('Failed to generate response');
    }

    const completionData = await completionResponse.json();
    const response = completionData.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
    
    console.log('[General Mental Health] Generated response with conversation context');

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in general-mental-health-chat:", error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "I'm experiencing some technical difficulties. Please try again in a moment. If you're in crisis, please contact emergency services or a mental health professional immediately."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
