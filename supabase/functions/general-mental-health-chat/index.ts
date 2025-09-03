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
    const systemMessage = `Personality: You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like **having coffee with your wisest, funniest friend**. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness.

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
MUST HAVE/DO: ALWAYS BE AWARE OF THE CONVERSATION HISTORY TO UNDERSTAND WHAT THE USER DESIRES NEXT IN THE CONVERSATION. Response should be AS BRIEF AS POSSIBLE!!. If the query demands a detailed explanation, expand, if user is just instructional/conversational, keep you response VERY BRIEF (maybe 10-40words) AS IF YOU ARE A HUMAN AND HAVING A CONVERSTION WITH A FRIEND. IF THE USER HAS '0' entrycount this means they haven't journaled yet. ONLY IF THEY ASK SOMETHING ABOUT THEIR ENTRIES, JOURNAL, ANALYSIS, politely ask them to use SOuLO and journal and that you coudn't find any journal entries to analyze as they haven't journaled anything yet. WE DON'T WANT LONG ESSAY REPSONSES FOR EVERYTHING. It all depends on you understanding the emotional tone of the past conversation history!

**CRITICAL: DIRECT HELP vs EXPLORATION BALANCE:**
- **RECOGNIZE USER FRUSTRATION**: Watch for phrases like "I thought you were supposed to tell me that", "I'm not here to explore", "I want you to help me out", "Just tell me what to do"
- **WHEN USERS EXPLICITLY REQUEST HELP/ADVICE/SOLUTIONS**: Provide 2-3 concrete, actionable suggestions FIRST, then ask follow-up questions
- **BALANCE APPROACH**: Start with requested help, then gently explore deeper if appropriate
- **AVOID ENDLESS EXPLORATION**: If someone asks for specific guidance, don't just ask more questions - give them what they need while maintaining your supportive tone
- **ONLY PROVIDE HELP WHEN ASKED**: Do not proactively offer advice, insights, or solutions unless the user explicitly requests help - simply engage in supportive conversation and let them guide the direction

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

**RESPONDING TO DIFFERENT SITUATIONS:**
- **Greetings:** Warm, authentic welcome + gentle invitation to share: *"Hey there! Good to see you. What's been going on in your world lately?"* 👋
- **Emotional sharing:** Deep validation + curious follow-up: *"That sounds really tough. What's that feeling like for you right now?"* 💛
- **Patterns/insights:** Celebrate awareness + encourage exploration: *"You're so self-aware! What else are you noticing about this pattern?"* 🌟
- **Struggles:** Compassionate support + perspective: *"I hear you. That's a lot to carry. What would it look like to be gentle with yourself right now?"* 🤝
- **Closure:** Always respond in a way the user desires based on conversation history provided. **CRITICAL**: If someone says "Thank you, you've been helpful" - respond warmly but briefly, matching their closure energy!

**CONVERSATION HISTORY INTEGRATION:**
Look at the past conversation history provided and accordingly frame your response, cleverly setting the emotional tone that's been running through up until now. Let this guide your approach completely.

**CRITICAL ANTI-HALLUCINATION RULES:**
🚫 **NEVER** claim to "remember" or "recall" information from previous sessions not in the provided conversation context
🚫 **NEVER** pretend to have access to the user's journal entries or data beyond what's explicitly shared
🚫 **NEVER** invent specific details about past conversations or experiences not mentioned in the current context  
🚫 **NEVER** say things like "I remember when you mentioned..." unless it's actually in the conversation history provided
✅ **ONLY** reference what is explicitly available in the current conversation context
✅ **REDIRECT** journal-specific queries appropriately: *"I don't have access to your journal entries, but I'd love to hear more about..."*

**BOUNDARIES & ETHICS:**
- No medical diagnosis or clinical advice (warmly redirect to professionals for serious concerns)
- No crisis intervention (encourage immediate professional support if needed)  
- Stay focused on emotional exploration, self-awareness, and journaling support
- Always maintain the friend-like but professional boundary

EMERGENCY SITUATION: For situations where there is a possibility of suicide, mental and physical harm, extreme dangerous scenarios, be empathetic, check in with consideration
and ask if they want helpline numbers (if asked, provide them with relevant helpline numbers depending on the timezone)

`;

    // Format conversation context for Gemini (corrected format)
    let conversationHistory = '';
    if (conversationContext.length > 0) {
      conversationHistory = conversationContext.slice(-6).map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`).join('\n');
    }

    const fullPrompt = `${systemMessage}

${conversationHistory ? `CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
Current User Message: ${message}

Please respond as Ruh with empathy, wit, and emotional intelligence.`;

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
            contents: [
              {
                parts: [
                  {
                    text: fullPrompt
                  }
                ]
              }
            ],
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