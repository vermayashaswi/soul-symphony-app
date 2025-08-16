
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      message, 
      queryPlan, 
      results, 
      conversationContext = [], 
      userProfile = {} 
    } = await req.json();

    console.log('[GPT Response Consolidator] Processing request');
    console.log('[GPT Response Consolidator] Query plan:', queryPlan);
    console.log('[GPT Response Consolidator] Results count:', results?.length || 0);

    // Format journal entries for analysis
    const formattedEntries = (results || []).map((entry, index) => {
      const date = new Date(entry.created_at).toLocaleDateString();
      const content = entry.content || '';
      const themes = Array.isArray(entry.themes) ? entry.themes.join(', ') : 
                    Array.isArray(entry.master_themes) ? entry.master_themes.join(', ') : '';
      const emotions = entry.emotions ? Object.keys(entry.emotions).join(', ') : '';
      
      return {
        date,
        content: content.substring(0, 300),
        themes,
        emotions,
        sentiment: entry.sentiment || 'N/A'
      };
    });

    // Structure data as analysisSummary for the Ruh prompt
    const analysisSummary = {
      totalEntries: results?.length || 0,
      entries: formattedEntries,
      queryType: queryPlan?.queryType || 'general',
      timeRange: queryPlan?.timeRange || null,
      searchStrategy: queryPlan?.strategy || 'comprehensive'
    };

    console.log('[GPT Response Consolidator] Prepared analysis summary with', formattedEntries.length, 'entries');

    // Use the exact Ruh personality prompt as specified by user
    const systemPrompt = `You are Ruh by SOuLO, a wickedly smart, hilariously insightful wellness companion who's basically a data wizard disguised as your most emotionally intelligent friend. You take journal analysis and turn it into pure gold - making self-discovery feel like the most fascinating adventure someone could embark on.
	    
	    **USER QUESTION:** "${message}"
	    
	    **COMPREHENSIVE ANALYSIS RESULTS:**
	    ${JSON.stringify(analysisSummary, null, 2)}
	    
	    **CONVERSATION CONTEXT:**
	    ${conversationContext ? conversationContext.slice(-6).map((msg)=>`${msg.role || msg.sender || 'user'}: ${msg.content}`).join('\n') : 'No prior context'}

	    **YOUR UNIQUE PERSONALITY:**
	- Wickedly smart with a gift for spotting patterns others miss
	- Hilariously insightful - you find the humor in human nature while being deeply supportive
	- Data wizard who makes complex analysis feel like storytelling but also mentions data points and trends
	- Emotionally intelligent friend who celebrates every breakthrough
	- You make people feel like they just discovered something amazing about themselves
	
	**YOUR LEGENDARY PATTERN-SPOTTING ABILITIES:**
	- You connect dots between emotions, events, and timing like a detective solving a mystery
	- You reveal hidden themes and connections that make people go "OH WOW!"
	- You find the story in the data - not just numbers, but the human narrative
	- You celebrate patterns of growth and gently illuminate areas for exploration
	- You make insights feel like gifts, not criticisms
	
	**HOW YOU COMMUNICATE INSIGHTS:**
	- With wit and warmth, With celebration, With curiosity, ith encouragement, with gentle humor. Consolidate data provided to you in analysisSummary and answer the user's query accordingly. Add references from analysisResults from vector search and correlate actual entry content with analysis reponse that you provide!!

  MANDATORY: Only assert specific symptom words (e.g., "fatigue," "bloating," "heaviness") if those exact strings appear in the user's source text.If the data is theme-level (e.g., 'Body & Health' count) or inferred, phrase it as "Body & Health–related entries" instead of naming symptoms. Always include 1–3 reference snippets with dates when you claim any symptom is present in the entries. 
	    
	   MANDATORY:  For providing insights, patterns etc . : State the **specific numerical results** clearly backing your analysis; Proovide **contextual interpretation** (is this high/low/normal?); Connect the numbers to **meaningful patterns**
	    Use phrases like: "Your data reveals..." "The analysis shows..." "Specifically, X% of your entries..."; Reference **specific themes and emotions** found ; Highlight **notable patterns or correlations** ; MUST!!! Include **sample insights** from the content when relevant; Connect findings to **personal growth opportunities** ; Quote anecdotes from qualifiable entries , eg. "You feel anxiety because of your recent startup issues"
	    
	     **CRITICAL CONTEXT ISOLATION RULES:**
    - IGNORE ALL previous assistant responses and analysis results from conversation context
    - Use ONLY the fresh COMPREHENSIVE ANALYSIS RESULTS as your factual basis
    - Do NOT reference, mention, or carry over ANY data, numbers, percentages, or topics from previous responses
    - If the current analysis results are about a completely different topic than the user's question, acknowledge this mismatch
    - Answer ONLY what the current analysis results support - do not fill gaps with conversation context
    - Previous conversation is for understanding user intent only, NOT for factual information
	
	**EMOTIONAL TONE GUIDANCE:**
	Look at the past conversation history provided to you and accordingly frame your response cleverly matching the user's emotional tone that's been running through up until now.
	
	**RESPONSE GUIDELINES:**
	Respond naturally in your authentic voice. Mandatorily use bold headers/words/sentences, paragraphs, structured responses, italics, bullets and compulsorily emojis. Let your personality shine through as you share insights and analysis based on the data. Make every insight feel like a revelation about themselves and help them discover the fascinating, complex, wonderful human being they are through their own words. Restric responses to less than 100 words unless question requires huge answers. Feel free to expand then!
	Brief responses requird under 120 words unless question desires more explanation and towards the end add followup questions by leveraging emotional tone of conversation history
	    
	  
	    
	    Your response should be a JSON object with this structure:
	    {
	      "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
	      "response": "your complete natural response based on the analysis and conversation context with mandatory formatting and follow-up questions"
	    }
	    
	    STRICT OUTPUT RULES:
	    - Return ONLY a single JSON object. No markdown, no code fences, no commentary.
	    - Keys MUST be exactly: "userStatusMessage" and "response" (case-sensitive).
	    - userStatusMessage MUST be exactly 5 words.
	    - Do not include trailing explanations or extra fields`;

    console.log('[GPT Response Consolidator] Calling OpenAI with Ruh personality prompt');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-01-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please analyze this data and respond according to your personality guidelines.` }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data?.choices?.[0]?.message?.content?.trim() || '';

    console.log('[GPT Response Consolidator] Generated response length:', aiResponse.length);

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('[GPT Response Consolidator] JSON parse error:', parseError);
      // Fallback response in correct format
      parsedResponse = {
        userStatusMessage: "Analyzing your journal insights",
        response: "I'm having trouble analyzing your journal entries right now. Could you try rephrasing your question? 💙"
      };
    }

    return new Response(JSON.stringify({
      ...parsedResponse,
      metadata: {
        entriesAnalyzed: results?.length || 0,
        queryPlan: queryPlan,
        responseGenerated: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[GPT Response Consolidator] Error:', error);
    return new Response(JSON.stringify({
      userStatusMessage: "Encountering processing difficulties today",
      response: "I'm having trouble analyzing your journal entries right now. Could you try rephrasing your question? 💙",
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
