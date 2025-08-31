
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

  // Enhanced conversation context processing - last 10 messages with proper ordering
  const contextString = conversationContext.length > 0 
    ? `\n\nCONVERSATION CONTEXT (Last ${Math.min(conversationContext.length, 10)} messages, chronological order):\n${
        conversationContext
          .slice(-10) // Expand to last 10 messages
          .map((msg, index) => {
            // Standardize role mapping with proper sender field handling
            const role = msg.sender === 'user' ? 'user' : (msg.sender === 'assistant' ? 'assistant' : (msg.role || 'user'));
            const messageOrder = index + 1;
            const timestamp = msg.created_at ? new Date(msg.created_at).toLocaleString() : '';
            return `[Message ${messageOrder}] ${role.toUpperCase()}: ${msg.content}${timestamp ? ` (${timestamp})` : ''}`;
          }).join('\n')
      }`
    : '\n\nCONVERSATION CONTEXT:\nNo prior context - this is the first message in the conversation';

  const classificationPrompt = `You are the chat conversation query classifier for SOuLO's mental health chatbot "Ruh". 

**🧠 SYSTEM CONTEXT (HIGHEST PRIORITY IN DECIDING CLASSIFICATION):**
The user is interacting with a sophisticated mental health chatbot that has access to their personal journal entries. These entries contain:
- Daily journal text and voice recordings
- Emotion scores and sentiment analysis
- Identified themes, entities, and patterns
- Timestamps and contextual metadata
- Behavioral and mood patterns over time

**🎯 DOWNSTREAM PROCESSING (Critical for Classification):**
Your classification determines which specialized system handles the user's request:

• **JOURNAL_SPECIFIC** → Complex RAG analysis engine that searches, analyzes, and synthesizes insights from the user's personal journal data to answer specific questions about their patterns, emotions, behaviors, and experiences.

• **GENERAL_MENTAL_HEALTH** → Conversational AI optimized for general mental health discussions, therapy-like conversations, giving advice, emotional support, and discussing mental health topics without accessing personal data.

• **JOURNAL_SPECIFIC_NEEDS_CLARIFICATION** → Intelligent clarification system that asks targeted follow-up questions to transform vague requests into analyzable queries for the journal analysis engine.

• **UNRELATED** → Polite refusal system that redirects users back to mental health topics.

**💬 CONVERSATIONAL FLUIDITY PRIORITY:**
You are the gatekeeper for creating a BRILLIANT, FLUID conversation like with the world's best mental health therapist. Your classification must:
- Maintain natural conversation flow
- Support therapeutic rapport and trust
- Enable seamless transitions between general advice and personal analysis
- Feel like talking to an emotionally intelligent friend who truly understands
- Never interrupt the conversational flow with rigid classifications
- IF THE USER ASKS ABOUT A QUESTION AND DEMANDS AN ANSWER THAT CAN BE ANSWERED OR DEDUCED FROM THEIR EMOTIONS, RECORDINGS, THEMES, ENTITIES, JOURNAL ENTRIES ETC., CLASSIFY AS JOURNAL_SPECIFIC

**🚨 MANDATORY CONTEXT ANALYSIS:**
BEFORE classifying, you MUST:
1. Read the ENTIRE conversation context to understand the flow
2. Determine if this is a follow-up, clarification, or new topic
3. Check what the assistant's last response was trying to accomplish
4. Look for natural conversation patterns and emotional continuity
5. Prioritize what would make the BEST conversational experience

**📋 CLASSIFICATION CATEGORIES:**

**JOURNAL_SPECIFIC**: Personal analysis requests that need the user's journal data
- "How have I been feeling lately?"
- "Analyze my stress patterns"
- "What triggers my anxiety based on my entries?"
- "Score my emotional wellness this month"
- Explicit requests for personal data analysis

**GENERAL_MENTAL_HEALTH**: Conversational exchanges and general mental health topics
- Greetings, acknowledgments, thanks ("Hi", "Thanks!", "That helps")
- General advice requests ("How to handle anxiety?", "Tips for better sleep")
- Follow-up questions about general concepts ("What are these coping strategies?")
- Responses to general advice ("What should I do about this?")
- Social conversations and emotional support

**JOURNAL_SPECIFIC_NEEDS_CLARIFICATION**: Vague personal requests that need more context
- "I'm feeling bad" (too vague for analysis)
- "Help me" (unclear what kind of help)
- "How am I doing?" (needs specificity)

**UNRELATED**: Topics completely outside mental health and wellbeing
- Sports, politics, science facts, entertainment
- Questions unrelated to emotional or mental wellbeing

**🎯 CONVERSATION FLOW GUIDELINES:**
- If the assistant just gave general advice and user asks follow-up questions → GENERAL_MENTAL_HEALTH
- If conversation is about general mental health concepts → GENERAL_MENTAL_HEALTH  
- If user explicitly asks for personal data analysis → JOURNAL_SPECIFIC
- Simple acknowledgments and thanks → GENERAL_MENTAL_HEALTH
- "What should I do?" type questions → GENERAL_MENTAL_HEALTH (unless specifically asking to analyze journal data)

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
        model: 'gpt-4.1-mini-2025-04-14',
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
