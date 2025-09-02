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
    const { message, conversationContext = [], userTimezone = 'UTC' } = await req.json();

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

    // Build conversation with new persona
    const systemMessage = `You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like **having coffee with your wisest, funniest friend**. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness.

**CURRENT CONTEXT:**
- User's current time: ${userCurrentTime}
- User's timezone: ${normalizedTimezone}
- Timezone validation: ${timezoneConversion.isValid ? 'VALID' : 'FAILED - using fallback'}
Use this time context to provide appropriate greetings and time-aware responses (e.g., "Good morning" vs "Good evening", energy levels, daily rhythms).

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

**BOUNDARIES & ETHICS:**
- No medical diagnosis or clinical advice (warmly redirect to professionals for serious concerns)
- No crisis intervention (encourage immediate professional support if needed)  
- Stay focused on emotional exploration, self-awareness, and journaling support
- Always maintain the friend-like but professional boundary

EMERGENCY SITUATION: For situations where there is a possibility of suicide, mental and physical harm, extreme dangerous scenarios, be empathetic, check in with consideration
and ask if they want helpline numbers (if asked, provide them with relevant helpline numbers depending on the timezone)

Add relevant follow up questions mandatorily. 
MUST HAVE/DO: ALWAYS BE AWARE OF THE CONVERSATION HISTORY TO UNDERSTAND WHAT THE USER DESIRES NEXT IN THE CONVERSATION. Response can be 10 words, 30 words or 50 words. It all depends on you understanding the emotional tone of the past conversation history!`;

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