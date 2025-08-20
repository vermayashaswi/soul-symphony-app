
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CONVERSATIONAL GPT-powered message classifier focusing on natural flow
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse body once to avoid re-reading on fallback
  const body = await req.json().catch(() => null);
  const message = body?.message;
  const conversationContext = Array.isArray(body?.conversationContext) ? body.conversationContext : [];

  if (!message) {
    return new Response(
      JSON.stringify({ error: 'Message is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }

  try {
    console.log(`[Query Classifier] Analyzing message: "${message}"`);

    // Get OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error('[Query Classifier] OPENAI_API_KEY missing - cannot classify via GPT');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured for chat-query-classifier' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Use GPT for natural conversation flow classification
    const classification = await gptClassifyMessage(message, conversationContext, openAiApiKey);

    console.log(`[Query Classifier] Result: ${classification.category}`);

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Query Classifier] Error:', error);

    return new Response(
      JSON.stringify({ error: 'Classification failed', details: String((error).message || error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

/**
 * GPT-powered classification with conversational flow prioritization
 */
async function gptClassifyMessage(
  message, 
  conversationContext, 
  apiKey
) {
  
  // Short-circuit acknowledgements to avoid unnecessary analysis
  const trimmed = (message || '').trim();
  const ackRegex = /^(ok(?:ay)?|k|kk|thanks|thank you|thx|cool|got it|sounds good|roger|understood|yep|yup|sure|👌|👍)[.!]?$/i;
  if (ackRegex.test(trimmed)) {
    return {
      category: 'GENERAL_MENTAL_HEALTH'
    };
  }

  const contextString = conversationContext.length > 0 
    ? `\n\nCONVERSATION CONTEXT:\n${conversationContext.slice(-6).map((msg) => `${msg.role || msg.sender || 'user'}: ${msg.content}`).join('\n')}`
    : '\n\nCONVERSATION CONTEXT:\nNo prior context';

  const classificationPrompt = `You are the a chat conversation query classifier for a voice journaling app, SOuLO's chatot called "Ruh'. On this app users record their journal entries and SOuLO application has all their entries, emotions, themes, time of entry, entry text etc. available for analysis. People visit the Ruh chatbot on SOuLO to converse about their feelings, problems, share stories, get analysis out of their regular journaling etc. 
  
  Use the conversation context provided to you to classify the latest user message and return ONE JSON object that exactly matches the schema. Be decisive and consistent. Below we have the categories and information about what happens downstream in SOuLO app's back end code if you classify a certain way

**STRONG TRIGGER WORD OVERRIDE (HIGHEST PRIORITY):**
- Messages containing "analyze", "score me", "rate me", "evaluate me", "assess me", "tell me about my", "what am I like", "scale of [number]" should ALWAYS be JOURNAL_SPECIFIC regardless of typos or informal grammar
- Messages with personal pronouns + analysis requests ("analyze if I", "score me on", "rate my") = JOURNAL_SPECIFIC
- Numerical scoring requests ("scale of 100", "1 to 10", "rate from 1-5") = JOURNAL_SPECIFIC
- Requests like "Can you help me uncover this?" , "I want you to tell me this about me" 
- These override all other considerations including typos, grammar, or conversation context

**TENTATIVE LANGUAGE DETECTION (CHECK BEFORE CONTEXT OVERRIDES):**
- Messages with uncertain/speculative language ("maybe", "might", "perhaps", "could be", "I think", "not sure", "possibly") should be classified as JOURNAL_SPECIFIC_NEEDS_CLARIFICATION even if they mention specific topics
- Examples "I am feeling bad" , "I am dealing with a lot of stuff" , "Last few days I've been tired"
- Examples: "maybe its something about my job", "I think it might be work related", "could be stress from relationships"
- Even in follow-up answers, if the user is uncertain, they need clarification

**CONTEXT OVERRIDE RULES (CHECK AFTER TENTATIVE LANGUAGE):**
- If the user is providing definitive answers to clarifying questions with specific details, classify as "JOURNAL_SPECIFIC"
- If user says "check", "look at", "analyze", "what does my", "in my entries", "from my data" - classify as "JOURNAL_SPECIFIC" 
- Only upgrade to JOURNAL_SPECIFIC if the user is confident and specific, not tentative

**CLARIFICATION LOOP PREVENTION:**
- If user has already provided analysis request + specific parameters (like scoring method), do NOT ask for more clarification
- If conversation shows user trying to proceed with analysis, classify as JOURNAL_SPECIFIC
- Only use NEEDS_CLARIFICATION for genuinely vague messages or tentative/uncertain responses
- If the user acknowledged the chatbot's response, classify as "GENERAL_MENTAL_HEALTH"

Categories (choose exactly one):
- JOURNAL_SPECIFIC: First-person, analyzable questions about the user's own patterns/feelings/behaviors. Examples: "How have I felt this month?", "Did meditation help me?", "What are my stress patterns lately?", "Check my entries for anxiety", "Look at my data from last week". Post this classification in downstream, SOuLO does a RAG anaysis of user's journal entries and helps them out with the coversational query or any ask that they might have about their personal,physical, mental or emotional wellbeing. Even if you are 50% confident that you can go ahead and analyze, classify as journal specific
- JOURNAL_SPECIFIC_NEEDS_CLARIFICATION: Personal but a little vague to analyze. Examples: "I'm sad", "Help", "How am I?" . A single short follow-up question would unlock analysis.Post this classification in downstream, SOuLO, further clarifies more about the user query and tries to dig into their asks by cross-questioning so that chatbot can help analyze journal 
- GENERAL_MENTAL_HEALTH: If user's queries contain conversational greetings, General ask for advices on mental health topics/skills/resources. This category also should contain conversational messages like greetings/acknowledgements/statements etc. Post this classification in downstream, SOuLO maintains normal conversations and/or answers general queries about mental health, physical and emotional health. Examples: "How to manage anxiety?", "Tips for sleep". "What causes bloating and fatigue?" "Why are People weird?" "Hey There" "Thanks for the help" "I loved your analysis" , "Perfect! That helped"
	- UNRELATED: Totally unrelated topics which can in no way gravitate towards exploring user's mental. physical or emotional well-being (Examples: "Who is the president of India", "Tell me more about quantum physics", "Who won the last FIFA World cup?". Post this classification in downstream, SOuLO, refuses politely to respond to unrelated stuff and instead inspires users to ask relevant questions

  You need to generate an output as below, depending on the conversation history that's provided to you. Your objective is to ensure, user's queries/concerns/asks are all met. You need to accordingly classify since you know what happens downstreaam post your classification

Output strictly a single JSON object (no code fences, no extra text) with this schema:
{
	  "category": "JOURNAL_SPECIFIC" | "JOURNAL_SPECIFIC_NEEDS_CLARIFICATION" | "GENERAL_MENTAL_HEALTH" | "UNRELATED",
}

Latest user message: "${message}"${contextString}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are a strict JSON classifier. Respond with a single JSON object only that matches the provided schema. No code fences, no commentary.' },
          { role: 'user', content: classificationPrompt }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 600
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || '';

    if (!content) {
      throw new Error('Empty OpenAI response');
    }

    console.log(`[Query Classifier] GPT Response: ${content}`);

    // Helper to extract JSON from possible fenced or prefixed content
    const extractJsonObject = (text) => {
      // ```json ... ```
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) return fenceMatch[1].trim();
      // First { ... last }
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1).trim();
      return text.trim();
    };

    // Parse the JSON response safely
    const jsonString = extractJsonObject(content);
    const result = JSON.parse(jsonString);
    
    // Validate the response
    if (!result.category || !['JOURNAL_SPECIFIC', 'JOURNAL_SPECIFIC_NEEDS_CLARIFICATION', 'GENERAL_MENTAL_HEALTH', 'UNRELATED'].includes(result.category)) {
      throw new Error('Invalid category in GPT response');
    }

    return {
      category: result.category
    };

  } catch (error) {
    console.error('[Query Classifier] GPT classification failed:', error);
    throw error;
  }
}
