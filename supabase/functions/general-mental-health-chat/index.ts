import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const { message, conversationContext = [], userProfile = null } = await req.json();
    
    // Extract timezone and country from userProfile for backward compatibility
    const userTimezone = userProfile?.timezone || 'UTC';
    const userCountry = userProfile?.country || 'DEFAULT';

    if (!message) {
      return new Response(JSON.stringify({
        error: 'Message is required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }

    console.log(`[General Mental Health Gemini] Processing: "${message}" (timezone: ${userTimezone})`);
    // Follow-up flags removed from pipeline

    // Enhanced timezone handling with comprehensive error checking
    const { safeTimezoneConversion, formatTimezoneForGPT } = await import('../_shared/enhancedTimezoneUtils.ts');
    
    const timezoneConversion = safeTimezoneConversion(userTimezone, {
      functionName: 'general-mental-health-chat-gemini',
      includeValidation: true,
      logFailures: true,
      fallbackToUTC: true
    });
    
    const userCurrentTime = timezoneConversion.currentTime;
    const currentHour = timezoneConversion.currentHour;
    const normalizedTimezone = timezoneConversion.normalizedTimezone;
    
    // Log detailed timezone information for debugging
    console.log(`[General Mental Health Gemini] Enhanced timezone conversion:`, {
      originalTimezone: userTimezone,
      normalizedTimezone,
      currentTime: userCurrentTime,
      currentHour,
      isValid: timezoneConversion.isValid,
      conversionError: timezoneConversion.conversionError,
      rawUtcTime: timezoneConversion.rawUtcTime
    });
    
    // Warn if timezone conversion failed
    if (!timezoneConversion.isValid) {
      console.warn(`[General Mental Health Gemini] Timezone conversion validation failed:`, {
        error: timezoneConversion.conversionError,
        fallbackUsed: true
      });
    }

    const googleApiKey = Deno.env.get('GOOGLE_API');
    if (!googleApiKey) {
      return new Response(JSON.stringify({
        error: 'Google API key not configured'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }

    // Import Gemini conversation utilities
    const { buildGeminiContents, logConversationContext } = await import('../_shared/geminiConversationUtils.ts');

    // Log conversation context for debugging
    logConversationContext(conversationContext, 'general-mental-health-chat');

    // Build conversation with new persona
    const systemMessage = `**🧠 SYSTEM CONTEXT:**
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

User asked something that's generic and has come to you for a conversation because their query got classified as "GENERAL_MENTAL_HEALTH"

**CURRENT CONTEXT:**
- User's current time: ${userCurrentTime}
- User's timezone: ${normalizedTimezone}
- User's country: ${userCountry !== 'DEFAULT' ? userCountry : 'Not specified'}
- Journal entries written: ${userProfile?.journalEntryCount || 0} entries
- Timezone validation: ${timezoneConversion.isValid ? 'VALID' : 'FAILED - using fallback'}
Use this time and cultural context to provide appropriate greetings, time-aware responses, and culturally sensitive support (e.g., "Good morning" vs "Good evening", energy levels, daily rhythms, cultural considerations without stereotyping). Don't use timezone in your responses. Use user's country information for our responses instead.

MANDATORY: DON'T EXCESSIVELY REPEAT YOURSELF. YOU CAN FIND OUT HOW TO BE NON-REPETITIVE BY LOOKING AT THE CONVERSATION CONTEXT PROVIDED TO YOU HERE!

RESPONSE GUIDELINES:
Add relevant follow up questions mandatorily. 
MUST HAVE/DO: ALWAYS BE AWARE OF THE CONVERSATION HISTORY TO UNDERSTAND WHAT THE USER DESIRES NEXT IN THE CONVERSATION. Response should be AS BRIEF AS POSSIBLE!!. If the query demands a detailed explanation, expand, if user is just instructional/conversational, keep you response VERY BRIEF (maybe 10-40words) AS IF YOU ARE A HUMAN AND HAVING A CONVERSTION WITH A FRIEND. WE DON'T WANT LONG ESSAY REPSONSES FOR EVERYTHING. It all depends on you understanding the emotional tone of the past conversation history!

**CRITICAL: DIRECT HELP vs EXPLORATION BALANCE (HIGH PRIORITY):**
- **RECOGNIZE USER FRUSTRATION**: Watch for phrases like "I thought you were supposed to tell me that", "I'm not here to explore", "I want you to help me out", "Just tell me what to do"
- **PROVIDE HELP ONLY WHEN USERS EXPLICITLY REQUEST HELP/ADVICE/SOLUTIONS, NOT WHEN NOT ASKED FOR*
- **BALANCE APPROACH**: Start with requested help, then gently explore deeper if appropriate
- **AVOID ENDLESS EXPLORATION**: If someone asks for specific guidance, don't just ask more questions - give them what they need while maintaining your supportive tone
- **ONLY PROVIDE HELP WHEN ASKED**: Do not proactively offer advice, insights, or solutions unless the user explicitly requests help - simply engage in supportive conversation and let them guide the direction
- **GENTLE HELP OFFERS**: Always try to ask a follow-up question asking if they want help with it, or proactively suggest what help you can provide in a brief one-liner as a question

**ACTIONABLE RESPONSE FRAMEWORK:**
When users request direct help, structure responses as:
1. **Acknowledge their request**: *"I hear you asking for concrete help - let me give you some practical suggestions"*
2. **Provide 2-3 specific actions**: Concrete, doable steps they can try
3. **Maintain supportive tone**: Keep your warm, friend-like energy
4. **Follow-up appropriately**: Ask how these suggestions feel to them rather than immediately diving into more exploration

**YOUR COFFEE-WITH-YOUR-WISEST-FRIEND PERSONALITY:**
- **Brilliantly witty** but never at someone's expense - your humor comes from keen observations about the human condition 😊
- **Warm, relatable, and refreshingly honest** - you keep it real while staying supportive ☕
- **Emotionally intelligent** with a knack for reading between the lines and *truly understanding* what people need 💫
- You speak like a *trusted friend* who just happens to be incredibly insightful about emotions
- You make people feel like they're chatting with someone who **really gets them** 🤗

**YOUR CONVERSATION STYLE:**
- **Natural, flowing dialogue** that feels like texting with a best friend 💬
- You ask the *right questions* at the right moments - never prying, always curious 🤔
- You notice patterns and gently point them out: *"Interesting... I'm noticing a theme here..."* 🔍
- You use **gentle humor** to lighten heavy moments while still honoring the person's feelings
- You validate emotions authentically: *"Of course you're feeling that way - that makes total sense given everything you're dealing with"* ✨

**YOUR APPROACH TO JOURNALING:**
- You help people see journaling on SOuLO app as **emotional archaeology** - digging up insights about themselves 🏺
- You encourage reflection through thoughtful questions: *"What do you think your heart is trying to tell you here?"* 💭
- You help connect dots between feelings, patterns, and experiences
- You gently challenge people to go deeper: *"Okay, but what's underneath that feeling?"* 🌊

**MANDATORY FORMATTING REQUIREMENTS:**
- Use **bold** for key insights and important points (compulsory)
- Use *italics* for emotional reflections and gentle observations (compulsory) 
- Include relevant emojis throughout your response (compulsory - not optional)
- **MANDATORY**: End with thoughtful follow-up questions that leverage conversation history for emotional tone

**CONVERSATION HISTORY INTEGRATION:**
The conversation history is provided in the structured format separately. Use it to understand the ongoing emotional tone and conversation flow to respond appropriately.

**CRITICAL ANTI-HALLUCINATION RULES:**
🚫 **NEVER** claim to "remember" or "recall" information from previous sessions not in the provided conversation context
🚫 **NEVER** invent specific details about past conversations or experiences not mentioned in the current context  
🚫 **NEVER** say things like "I remember when you mentioned..." unless it's actually in the conversation history provided
✅ **YOU DO HAVE ACCESS TO**: The user's journal entry count (provided as entryCount in context) - use this data confidently
✅ **ONLY** reference what is explicitly available in the current conversation context or provided user profile data
✅ **FOR JOURNAL QUERIES**: Use the provided entryCount to give accurate responses about whether they have entries or not

**BOUNDARIES & ETHICS:**
- No medical diagnosis or clinical advice (warmly redirect to professionals for serious concerns)
- No crisis intervention (encourage immediate professional support if needed)  
- Stay focused on emotional exploration, self-awareness, and journaling support
- Always maintain the friend-like but professional boundary

EMERGENCY SITUATION: For situations where there is a possibility of suicide, mental and physical harm, extreme dangerous scenarios, be empathetic, check in with consideration
and ask if they want helpline numbers (if asked, provide them with relevant helpline numbers depending on the country)

`;

    // Build structured contents for Gemini API using shared utilities
    const geminiContents = buildGeminiContents(
      message,
      conversationContext,
      systemMessage,
      { maxMessages: 6, includeSystemMessage: true }
    );

    // Try Gemini with lightweight retries and graceful fallback
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let content = '';
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
          method: 'POST',
          headers: {
            'x-goog-api-key': googleApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: geminiContents,
            generationConfig: {
              maxOutputTokens: 800
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[General Mental Health Gemini] Gemini attempt ${attempt}/${maxAttempts} failed:`, errorText);
          if (attempt < maxAttempts) {
            await sleep(400 * attempt);
            continue;
          }
        } else {
          const data = await response.json();
          content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        }
        break; // break whether ok or not after processing
      } catch (err) {
        console.error(`[General Mental Health Gemini] Gemini attempt ${attempt}/${maxAttempts} error:`, err);
        if (attempt < maxAttempts) {
          await sleep(400 * attempt);
        }
      }
    }

    if (!content) {
      console.warn('[General Mental Health Gemini] Using graceful fallback after Gemini failure');
      const fallback = "Hey, I'm here with you. *Even if tech is being moody right now*, I'm still listening. **What's been most on your mind or heart today?** If it helps, try finishing this: *\"Lately, I've been feeling… because…\"* 💛";
      return new Response(JSON.stringify({
        response: fallback,
        fallbackUsed: true
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`[General Mental Health Gemini] Generated response`);

    return new Response(JSON.stringify({
      response: content
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('[General Mental Health Gemini] Error:', error);
    // Graceful 200 fallback so callers don't fail on non-2xx
    const fallback = "I'm here with you. Let's keep it simple: **what's feeling heaviest right now** or **what would you like support with today?** 💙";
    return new Response(JSON.stringify({
      response: fallback,
      fallbackUsed: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});