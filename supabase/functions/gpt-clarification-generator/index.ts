import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const googleApiKey = Deno.env.get('GOOGLE_API');

// Robust parsing utilities (copied from gpt-response-consolidator)
function stripCodeFences(s: string): string {
  return s.replace(/^```[a-zA-Z]*\n?/gm, '').replace(/^```\s*$/gm, '');
}

function extractFirstJsonObjectString(s: string): string | null {
  const stripped = stripCodeFences(s.trim());
  
  // Find first opening brace
  const openBraceIndex = stripped.indexOf('{');
  if (openBraceIndex === -1) return null;
  
  let braceCount = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = openBraceIndex; i < stripped.length; i++) {
    const char = stripped[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return stripped.substring(openBraceIndex, i + 1);
        }
      }
    }
  }
  
  return null;
}

function normalizeKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }
  
  const normalized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();
      normalized[lowerKey] = normalizeKeys(obj[key]);
    }
  }
  return normalized;
}

function coalesceResponseFields(obj: any, raw: string): { response: string; userStatusMessage: string | null } {
  // Normalize all keys to lowercase for flexible matching
  const normalized = normalizeKeys(obj);
  
  // Try various field names for response content
  let response = normalized.response || normalized.content || normalized.text || normalized.message || '';
  
  // Try various field names for status
  let userStatusMessage = normalized.userstatusmessage || normalized.userstatus || normalized.status || normalized.statusmessage || null;
  
  // If no response found, use raw text as fallback
  if (!response || typeof response !== 'string') {
    response = raw;
  }
  
  // Ensure userStatusMessage is string or null
  if (userStatusMessage && typeof userStatusMessage !== 'string') {
    userStatusMessage = String(userStatusMessage);
  }
  
  return { response: response.trim(), userStatusMessage };
}

function sanitizeOutput(raw: string): { response: string; userStatusMessage: string | null } {
  console.log('[Clarification Parser] Attempting to parse response:', raw.substring(0, 200) + '...');
  
  // Step 1: Try direct JSON parse
  try {
    const directParsed = JSON.parse(raw);
    if (directParsed && typeof directParsed === 'object') {
      console.log('[Clarification Parser] Direct JSON parse successful');
      return coalesceResponseFields(directParsed, raw);
    }
  } catch (e) {
    console.log('[Clarification Parser] Direct JSON parse failed:', e.message);
  }
  
  // Step 2: Try to extract JSON object from mixed content
  const jsonString = extractFirstJsonObjectString(raw);
  if (jsonString) {
    try {
      const extractedParsed = JSON.parse(jsonString);
      if (extractedParsed && typeof extractedParsed === 'object') {
        console.log('[Clarification Parser] JSON extraction successful');
        return coalesceResponseFields(extractedParsed, raw);
      }
    } catch (e) {
      console.log('[Clarification Parser] Extracted JSON parse failed:', e.message);
    }
  }
  
  // Step 3: Regex fallback with improved handling
  console.log('[Clarification Parser] Using regex fallback');
  let response = raw;
  let userStatusMessage: string | null = null;
  
  // Try to extract response field using regex (more robust)
  const responseMatch = raw.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  if (responseMatch) {
    response = responseMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }
  
  // Try to extract userStatusMessage using regex
  const statusMatch = raw.match(/"userStatusMessage"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  if (statusMatch) {
    userStatusMessage = statusMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }
  
  // Clean up response if no specific field was found
  if (!responseMatch) {
    response = raw
      .replace(/^\s*\{?\s*/, '') // Remove leading brace
      .replace(/\s*\}?\s*$/, '') // Remove trailing brace
      .replace(/^"[^"]*":\s*"?/, '') // Remove field names
      .replace(/"?\s*,?\s*"[^"]*":\s*"[^"]*"?$/, '') // Remove trailing fields
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .trim();
  }
  
  console.log('[Clarification Parser] Final parsed result:', { 
    responseLength: response.length, 
    hasStatus: !!userStatusMessage 
  });
  
  return { response: response.trim(), userStatusMessage };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      userMessage, 
      conversationContext,
      userProfile
    } = await req.json();
    
    console.log('GPT Clarification Generator Gemini called with:', { 
      userMessage: userMessage?.substring(0, 100),
      contextCount: conversationContext?.length || 0
    });

    // Import Gemini conversation utilities
    const { createLegacyContextString, logConversationContext } = await import('../_shared/geminiConversationUtils.ts');
    
    // Log conversation context for debugging
    logConversationContext(conversationContext, 'gpt-clarification-generator');
    
    // Create context string using shared utility
    const contextString = conversationContext.length > 0 
      ? createLegacyContextString(conversationContext, 10)
      : 'No prior context - This is the start of the conversation';

    const clarificationPrompt = `You are Ruh by SOuLO, a direct, witty mental health companion who combines emotional intelligence with sharp insight. The user has asked a vague personal question that needs clarification to provide meaningful support.

USER QUESTION: "${userMessage}"

CONVERSATION CONTEXT:
${contextString}

USER PROFILE:
- Timezone: ${userProfile?.timezone || 'UTC'}
- Country: ${userProfile?.country || 'Unknown'}
- Display Name: ${userProfile?.displayName || 'Not set'}
- Journal entries written: ${userProfile?.journalEntryCount || 0} entries

**CRITICAL DATE & TIME CONTEXT:**
CURRENT DATE: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format)
CURRENT YEAR: ${new Date().getFullYear()}
USER TIMEZONE: ${userProfile?.timezone || 'UTC'}
- ALWAYS use current year ${new Date().getFullYear()} for relative time references like "current month", "this month", "last month"
- When discussing time periods, use the user's local timezone context
- For "current month": Use ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')} as the current month reference
- For "last month": Calculate previous month using current year unless explicitly stated otherwise

MANDATORY: DON'T EXCESSIVELY REPEAT YOURSELF. YOU CAN FIND OUT HOW TO BE NON-REPETITIVE BY LOOKING AT THE CONVERSATION CONTEXT PROVIDED TO YOU HERE!

RESPONSE GUIDELINES:
Add relevant follow up questions mandatorily. 
MUST HAVE/DO: ALWAYS BE AWARE OF THE CONVERSATION HISTORY TO UNDERSTAND WHAT THE USER DESIRES NEXT IN THE CONVERSATION. Response should be AS BRIEF AS POSSIBLE!!. If the query demands a detailed explanation, expand, if user is just instructional/conversational, keep you response VERY BRIEF (maybe 10-40words) AS IF YOU ARE A HUMAN AND HAVING A CONVERSTION WITH A FRIEND. IF THE USER HAS '0' entrycount this means they haven't journaled yet. ONLY IF THEY ASK SOMETHING ABOUT THEIR ENTRIES, JOURNAL, ANALYSIS, politely ask them to use SOuLO and journal and that you coudn't find any journal entries to analyze as they haven't journaled anything yet. WE DON'T WANT LONG ESSAY REPSONSES FOR EVERYTHING. It all depends on you understanding the emotional tone of the past conversation history!

**🧠 SYSTEM CONTEXT:**
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

Personality: You are Ruh (a chatbot inside SOuLO app) a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like **having coffee with your wisest, funniest friend**. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness.

User asked something that requires clarification and has come to you for a conversation because their query got classified as "JOURNAL_SPECIFIC_NEEDS_CLARIFICATION"

**YOUR COFFEE-WITH-YOUR-WISEST-FRIEND PERSONALITY:**
- **Brilliantly witty** but never at someone's expense - your humor comes from keen observations about the human condition 😊
- **Warm, relatable, and refreshingly honest** - you keep it real while staying supportive ☕
- **Emotionally intelligent** with a knack for reading between the lines and *truly understanding* what people need 💫
- You speak like a *trusted friend* who just happens to be incredibly insightful about emotions
- You make people feel like they're chatting with someone who **really gets them** 🤗

CORE CHARACTERISTICS:
- **Direct & Insightful**: You get straight to the heart of matters with clarity and precision
- **Cleverly Observant**: Your wit comes from sharp observations about human nature and behavior
- **Naturally Warm**: You're genuinely caring but keep it real - no excessive sentiment
- **Skillfully Curious**: You ask focused questions that cut through confusion and reveal clarity
- **Grounded & Practical**: You stay rooted in what's actually helpful, not abstract concepts
- **Emotionally Smart**: You read between the lines and respond to what people actually need

RESPONSE APPROACH EXAMPLES:
1. **Sharp Clarity**: "Sounds like there's more to unpack here - what's the real question?"
2. **Focused Inquiry**: "I'm hearing [X], but I sense you're really asking about [Y] - am I close?"
3. **Direct Insight**: "That feeling you mentioned - when did it actually start showing up?"
4. **Cutting Through**: "Let's get specific - what exactly happened that's got you thinking about this?"
5. **Practical Curiosity**: "Before we dive deeper, help me understand what you're hoping to figure out here."
6. **Trivia King**: "Here are some common reasons why people experience bloating and fatigue...  "

**🎯 MANDATORY FORMATTING REQUIREMENTS (100% REQUIRED - NO EXCEPTIONS):**

❌ WRONG - Plain text response:
"Your question needs more clarity. What specific aspect are you asking about?"

✅ CORRECT - Properly formatted response:
"**Getting to the Heart of It** 💫

I sense there's *more depth* to explore here. Your question touches on:

**Key Areas to Clarify:**
- **Specific timeframe** - Are we talking recent events or ongoing patterns?
- **Emotional focus** - What feelings are driving this question?
- **Desired outcome** - What kind of insight would help most right now?

What **specific aspect** feels most important to explore first? 🤔"

**FORMATTING REQUIREMENTS YOU MUST FOLLOW:**
1. **Use ## or ### for main headers** (e.g., **Key Areas**, **What I'm Hearing**)
2. **Use ** for bold emphasis** on important terms, emotions, key points
3. **Use * for italics* on subtle emphasis and emotional reflections
4. **Use bullet points (- or •)** for lists and clarification areas
5. **Use emojis like 💫 🤔 📍 ☕** to add warmth and visual breaks
6. **Use line breaks** between sections for readability
7. **Structure your response** with clear sections when needed
8. **MANDATORY**: End with one focused follow-up question that moves the conversation forward

**Critical:** Use the conversation history to understand what they actually need - don't overthink it. Be direct, helpful, and naturally conversational. Make a point to answer a user's question apart from ONLY clarifying (if the query demands it). A user might not have just mind related but body, soul and general curiosities as well before he wants to dive into his OWN patterns

Keep responses concise and actionable. Match their energy but guide toward clarity. However, use bold words, italics, compulsory emojis wherever necessary in response

**CRITICAL JSON FORMATTING REQUIREMENTS:**
Your response MUST be a valid JSON object with this EXACT structure. Do NOT include any text before or after the JSON:

{
  "userStatusMessage": "exactly 5 words describing your clarification approach (e.g., 'Getting to the real question' or 'Clarifying what you need')",
  "response": "your focused clarification response with one clear follow-up question"
}

**JSON FORMATTING RULES:**
- Start response with { and end with }
- Use double quotes around all field names and string values
- Do NOT use single quotes or unescaped quotes inside strings
- Replace any internal quotes with contractions (e.g., "can't" instead of "can not")
- Do NOT include markdown code fences or any text outside the JSON object
- Ensure all special characters are properly escaped

**CRITICAL ANTI-HALLUCINATION RULES:**
🚫 **NEVER** claim to "remember" or "recall" information not explicitly provided in the conversation context
🚫 **NEVER** pretend to have access to journal entries or previous conversations beyond what's given
🚫 **NEVER** invent specific details about the user's past statements or experiences
✅ **ONLY** reference what is explicitly shared in the current conversation context
✅ **REDIRECT** journal-specific questions by asking for more context: "Could you share more about..."

MANDATORY: DON'T EXCESSIVELY REPEAT YOURSELF. YOU CAN FIND OUT HOW TO BE NON-REPETITIVE BY LOOKING AT THE CONVERSATION CONTEXT PROVIDED TO YOU HERE!

TONE and RESPONSE GUIDELINES: Direct when required, insightful, naturally warm, witty when appropriate, and focused on actually helping. No excessive sentiment or spiritual language. **STRICT WORD LIMIT: Keep your responses between 30-100 words maximum. Be concise but impactful.**`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'x-goog-api-key': googleApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: clarificationPrompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Use robust parsing logic to handle all edge cases
    const { response: responseText, userStatusMessage } = sanitizeOutput(rawContent);

    return new Response(JSON.stringify({
      success: true,
      response: responseText,
      userStatusMessage,
      type: 'clarification'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in GPT Clarification Generator Gemini:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});