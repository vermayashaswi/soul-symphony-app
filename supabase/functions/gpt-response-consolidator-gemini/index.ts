import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const googleApiKey = Deno.env.get('GOOGLE_API');

// JSON sanitization utilities for consolidator
function stripCodeFences(s: string): string {
  try { return s.replace(/```(?:json)?/gi, '').trim(); } catch { return s; }
}

function extractFirstJsonObjectString(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

function normalizeKeys(obj: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k.toLowerCase()] = (obj as any)[k];
    }
  }
  return out;
}

function coalesceResponseFields(obj: any, raw: string): { responseText: string; statusMsg: string | null } {
  const lower = normalizeKeys(obj);
  const statusMsg = (lower['userstatusmessage'] ?? lower['statusmessage'] ?? lower['user_status_message'] ?? null) as string | null;
  const responseTextCandidate = (lower['response'] ?? lower['content'] ?? lower['message'] ?? lower['text'] ?? null);
  const responseText = typeof responseTextCandidate === 'string' ? responseTextCandidate : raw;
  return { responseText: responseText, statusMsg };
}

function sanitizeConsolidatorOutput(raw: string): { responseText: string; statusMsg: string | null; meta: Record<string, any> } {
  const meta: Record<string, any> = { hadCodeFence: /```/i.test(raw || '') };
  try {
    if (!raw) {
      console.error('[CONSOLIDATOR GEMINI] Empty response from Gemini API');
      return { responseText: 'I ran into a formatting issue preparing your insights. Let\'s try again.', statusMsg: null, meta };
    }
    let s = stripCodeFences(raw);
    meta.afterStripPrefix = s.slice(0, 60);
    let parsed: any = null;
    if (s.trim().startsWith('{')) {
      try {
        parsed = JSON.parse(s);
        meta.parsedDirect = true;
      } catch {
        const jsonStr = extractFirstJsonObjectString(s);
        if (jsonStr) {
          try {
            parsed = JSON.parse(jsonStr);
            meta.parsedExtracted = true;
          } catch {
            console.error('[CONSOLIDATOR GEMINI] Failed to parse extracted JSON:', jsonStr);
          }
        }
      }
    }
    if (parsed && typeof parsed === 'object') {
      const { responseText, statusMsg } = coalesceResponseFields(parsed, s);
      return { responseText, statusMsg, meta };
    }
    return { responseText: s, statusMsg: null, meta };
  } catch (e) {
    console.error('[CONSOLIDATOR GEMINI] Sanitization error:', e);
    return { responseText: raw, statusMsg: null, meta };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json();
    const userMessage = raw.userMessage;
    const researchResults = raw.researchResults ?? raw.analysisResults ?? [];
    const conversationContext = raw.conversationContext;
    const userProfile = raw.userProfile;
    const streamingMode = raw.streamingMode ?? false;
    const messageId = raw.messageId;
    const threadId = raw.threadId;
    
    // Generate unique consolidation ID for tracking
    const consolidationId = `cons_gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[CONSOLIDATION START GEMINI] ${consolidationId}:`, { 
      userMessage: userMessage?.substring(0, 100),
      researchResultsCount: researchResults?.length || 0,
      contextCount: conversationContext?.length || 0,
      streamingMode,
      messageId,
      timestamp: new Date().toISOString()
    });

    // Enhanced data validation - check for empty research results
    if (!researchResults || researchResults.length === 0) {
      console.error(`[${consolidationId}] No research results provided to consolidator`);
      return new Response(JSON.stringify({
        success: true,
        response: "I couldn't find any relevant information in your journal entries for this query. Could you try rephrasing your question or check if you have entries related to this topic?",
        userStatusMessage: "No matching entries found",
        analysisMetadata: {
          totalSubQuestions: 0,
          strategiesUsed: [],
          dataSourcesUsed: { vectorSearch: false, sqlQueries: false, errors: true }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize variables at function scope to avoid scoping issues
    let hasJournalEntries = false;
    let journalEntries: any[] = [];

    // Data integrity validation - check for processed research results
    if (researchResults && researchResults.length > 0) {
      console.log(`[RESEARCH DATA VALIDATION GEMINI] ${consolidationId}:`, {
        totalResults: researchResults.length,
        resultTypes: researchResults.map((r: any, i: number) => ({
          index: i,
          question: r?.subQuestion?.question?.substring(0, 50) || 'unknown',
          hasExecutionSummary: !!r?.executionSummary,
          summaryType: r?.executionSummary?.resultType || 'unknown',
          summaryDataType: r?.executionSummary?.dataType || 'unknown',
          hasError: !!r?.executionResults?.error || !!r?.error
        }))
      });
      
      // Check for processed summaries vs raw data
      const hasProcessedSummaries = researchResults.some((r: any) => r?.executionSummary);
      const hasRawResults = researchResults.some((r: any) => 
        r?.executionResults?.sqlResults || r?.executionResults?.vectorResults);
      
      // PHASE 4 FIX: Check specifically for journal entries from mandatory vector search
      hasJournalEntries = researchResults.some((r: any) => 
        (r?.executionResults?.vectorResults && r.executionResults.vectorResults.length > 0) ||
        (r?.executionSummary?.resultType === 'journal_content_retrieval' && r.executionSummary?.count > 0)
      );
        
      console.log(`[DATA SUMMARY GEMINI] ${consolidationId}:`, {
        hasProcessedSummaries,
        hasRawResults,
        hasJournalEntries, // PHASE 4 FIX: Log journal entries availability
        userQuestion: userMessage,
        dataStructureType: hasProcessedSummaries ? 'processed_summaries' : 'raw_results'
      });

      // Enhanced validation for empty analysis objects
      if (!hasProcessedSummaries && !hasRawResults) {
        console.warn(`[${consolidationId}] No processed summaries or raw results found despite research execution`);
        return new Response(JSON.stringify({
          success: true,
          response: "I searched through your journal entries but couldn't find specific content that matches your question. This might be because you haven't written about this topic yet, or the topic might be phrased differently in your entries. Could you try asking about it in a different way?",
          userStatusMessage: "Search completed, no matches",
          analysisMetadata: {
            totalSubQuestions: researchResults.length,
            strategiesUsed: [],
            dataSourcesUsed: { vectorSearch: false, sqlQueries: false, errors: false }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // PHASE 1 FIX: Extract and prominently feature journal entries
      journalEntries = researchResults.flatMap((research: any, index: number) => {
        // Extract journal entries from vector search results
        const vectorResults = research?.executionResults?.vectorResults || [];
        const processedEntries = research?.executionSummary?.sampleEntries || [];
        
        // Process vector results (actual journal content)
        const vectorEntries = vectorResults.map((entry: any) => ({
          id: entry.id,
          content: entry.content || '',
          created_at: entry.created_at,
          similarity: entry.similarity,
          emotions: entry.emotions || {},
          themes: entry.themes || entry.master_themes || [],
          source: 'vector_search',
          subQuestionIndex: index + 1
        }));
        
        // Process sample entries from execution summaries
        const sampleEntries = processedEntries.map((entry: any) => ({
          id: entry.id,
          content: entry.content || '',
          created_at: entry.created_at,
          similarity: entry.similarity || 0,
          emotions: entry.emotions || {},
          themes: entry.themes || entry.master_themes || [],
          source: 'processed_summary',
          subQuestionIndex: index + 1
        }));
        
        return [...vectorEntries, ...sampleEntries];
      }).filter(entry => entry.content && entry.content.length > 0);

      console.log(`[${consolidationId}] Extracted ${journalEntries.length} journal entries for Gemini integration`);
      
      // PHASE 4 FIX: Enhanced validation and logging for journal entries
      if (!hasJournalEntries) {
        console.warn(`[${consolidationId}] No journal entries found from mandatory vector search - responses may lack specific examples`);
      } else {
        const entryCount = journalEntries?.length || 0;
        console.log(`[${consolidationId}] Successfully extracted ${entryCount} journal entries for Gemini integration`);
        
        if (entryCount > 0) {
          const entriesWithContent = journalEntries.filter((e: any) => e.content && e.content.length > 50);
          console.log(`[${consolidationId}] Journal entries validation: ${entriesWithContent.length}/${entryCount} have substantial content`);
        }
      }
    }

    // Permissive pass-through of Researcher results (no restrictive parsing)
    const MAX_SQL_ROWS = 200;
    const MAX_VECTOR_ITEMS = 20;

    const analysisSummary = researchResults.map((research: any, index: number) => {
      // Handle both processed summaries (new format) and raw results (legacy format)
      if (research?.executionSummary) {
        // NEW FORMAT: Processed summaries from smart query planner
        console.log(`[${consolidationId}] Processing summary for sub-question ${index + 1}:`, {
          resultType: research.executionSummary.resultType,
          dataType: research.executionSummary.dataType,
          summary: research.executionSummary.summary?.substring(0, 100)
        });
        
        return {
          subQuestion: research?.subQuestion ?? null,
          executionSummary: research.executionSummary,
          processedData: {
            resultType: research.executionSummary.resultType,
            dataType: research.executionSummary.dataType,
            summary: research.executionSummary.summary,
            count: research.executionSummary.count,
            analysis: research.executionSummary.analysis,
            sampleEntries: research.executionSummary.sampleEntries || [],
            totalEntriesContext: research.executionSummary.totalEntriesContext
          },
          error: research?.error ?? null
        };
      } else {
        // LEGACY FORMAT: Raw SQL/Vector results (fallback)
        const originalSql = Array.isArray(research?.executionResults?.sqlResults)
          ? research.executionResults.sqlResults
          : null;
        const originalVector = Array.isArray(research?.executionResults?.vectorResults)
          ? research.executionResults.vectorResults
          : null;

        const sqlTrimmed = !!(originalSql && originalSql.length > MAX_SQL_ROWS);
        const vectorTrimmed = !!(originalVector && originalVector.length > MAX_VECTOR_ITEMS);

        if (sqlTrimmed || vectorTrimmed) {
          console.log('Consolidator Gemini trimming payload sizes', {
            index,
            sqlRows: originalSql?.length || 0,
            sqlTrimmedTo: sqlTrimmed ? MAX_SQL_ROWS : (originalSql?.length || 0),
            vectorItems: originalVector?.length || 0,
            vectorTrimmedTo: vectorTrimmed ? MAX_VECTOR_ITEMS : (originalVector?.length || 0),
          });
        }

        return {
          subQuestion: research?.subQuestion ?? null,
          researcherOutput: research?.researcherOutput ?? null,
          executionResults: {
            ...(research?.executionResults ?? {}),
            sqlResults: originalSql ? originalSql.slice(0, MAX_SQL_ROWS) : originalSql,
            sqlRowCount: originalSql?.length ?? 0,
            sqlRowCappedTo: sqlTrimmed ? MAX_SQL_ROWS : (originalSql?.length ?? 0),
            vectorResults: originalVector ? originalVector.slice(0, MAX_VECTOR_ITEMS) : originalVector,
            vectorItemCount: originalVector?.length ?? 0,
            vectorItemCappedTo: vectorTrimmed ? MAX_VECTOR_ITEMS : (originalVector?.length ?? 0),
          },
          error: research?.executionResults?.error ?? research?.error ?? null,
          notes: sqlTrimmed || vectorTrimmed
            ? {
                truncated: true,
                reason: 'Soft cap applied to prevent token overflow',
                caps: { MAX_SQL_ROWS, MAX_VECTOR_ITEMS },
              }
            : undefined,
        };
      }
    });

    // Enhanced timezone handling with validation
    const { safeTimezoneConversion, formatTimezoneForGPT } = await import('../_shared/enhancedTimezoneUtils.ts');
    
    const rawUserTimezone = userProfile?.timezone || 'UTC';
    const timezoneConversion = safeTimezoneConversion(rawUserTimezone, {
      functionName: 'gpt-response-consolidator-gemini',
      includeValidation: true,
      logFailures: true
    });
    
    const timezoneFormat = formatTimezoneForGPT(rawUserTimezone, {
      includeUTCOffset: true,
      functionName: 'gpt-response-consolidator-gemini'
    });
    
    console.log(`[CONSOLIDATOR GEMINI] ${consolidationId} timezone info:`, {
      rawTimezone: rawUserTimezone,
      normalizedTimezone: timezoneConversion.normalizedTimezone,
      currentTime: timezoneConversion.currentTime,
      isValid: timezoneConversion.isValid,
      validationNotes: timezoneFormat.validationNotes
    });
    
    const userTimezone = timezoneConversion.normalizedTimezone;
    
    // Get user's journal timeline data for proper time context
    let timelineContext = '';
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      );
      
      const { data: timelineData, error: timelineError } = await supabaseClient
        .from('Journal Entries')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
        
      const { data: latestData, error: latestError } = await supabaseClient
        .from('Journal Entries')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (timelineData && latestData) {
        const firstEntryDate = new Date(timelineData.created_at);
        const lastEntryDate = new Date(latestData.created_at);
        const currentTime = new Date();
        
        // Format dates in user's timezone
        const firstEntryFormatted = firstEntryDate.toLocaleDateString('en-US', { 
          timeZone: userTimezone, 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        });
        const lastEntryFormatted = lastEntryDate.toLocaleDateString('en-US', { 
          timeZone: userTimezone, 
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        });
        
        // Calculate days since last entry
        const daysSinceLastEntry = Math.floor((currentTime.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24));
        
        timelineContext = `
    **CRITICAL TIMELINE CONTEXT:**
    - User's first journal entry: ${firstEntryFormatted}
    - User's most recent journal entry: ${lastEntryFormatted} (${daysSinceLastEntry} days ago)
    - NEVER use temporal words like "tonight", "today", "this evening" unless entries exist for the current date
    - When referencing time periods, be specific about the actual dates from the data
    - The user's last activity was ${daysSinceLastEntry} days ago, not recent
        `;
      }
    } catch (error) {
      console.warn(`[${consolidationId}] Could not fetch timeline data:`, error);
      timelineContext = '- No timeline data available, avoid specific time references';
    }
    
    const contextData = {
      userProfile: {
        timezone: userTimezone,
        journalEntryCount: userProfile?.journalEntryCount || 'unknown',
        premiumUser: userProfile?.is_premium || false,
      },
      meta: {
        totalResearchItems: analysisSummary.length,
        subQuestionsGenerated: analysisSummary.map(item => item.subQuestion).filter(Boolean),
        originalUserQuery: userMessage,
      }
    };

    // Construct the Gemini prompt
    const conversationContextText = Array.isArray(conversationContext) ? 
      conversationContext
        .slice(-8) // Last 8 messages for context
        .map((msg: any, index: number) => `${index + 1}. ${msg.sender}: ${msg.content}`)
        .join('\n') : 'No conversation context available';

    const geminiPrompt = `🚨 CRITICAL FORMATTING REQUIREMENT: YOU MUST USE MARKDOWN FORMATTING 🚨

You are Ruh by SOuLO, a brilliantly witty, non-judgmental mental health companion who makes emotional exploration feel like **having coffee with your wisest, funniest friend**. You're emotionally intelligent with a gift for making people feel seen, heard, and understood while helping them journal their way to deeper self-awareness.

**YOUR PERSONALITY (MANDATORY: Keep This Warm/Witty Tone):**
- **Brilliantly witty** but never at someone's expense - your humor comes from keen observations about the human condition 😊
- **Warm, relatable, and refreshingly honest** - you keep it real while staying supportive ☕
- **Emotionally intelligent** with a knack for reading between the lines and *truly understanding* what people need 💫
- You speak like a *trusted friend* who just happens to be incredibly insightful about emotions
- You make people feel like they're chatting with someone who **really gets them** 🤗

**🎯 ABSOLUTE MANDATORY FORMATTING RULES (100% REQUIRED - NO EXCEPTIONS):**

❌ WRONG - Plain text response:
"Your feelings around family and identity are quite nuanced. The journal entries reveal strong emotions."

✅ CORRECT (ONLY AN EXAMPLE BELOW TO SHOW YOU WHAT A FORMAT LOOKS LIKE. DON'T BLINDLY FOLLOW THIS)- Properly formatted response:
"**Your Family & Identity Journey** 💫

Your feelings around **family and identity** are quite nuanced. The journal entries reveal:

**Key Emotional Patterns:**
- **Nostalgia (0.7)** - Strong connection to family memories
- **Concern (0.7)** - Ongoing family-related worries  
- **Empathy (0.6)** - Deep emotional attunement

**What This Reveals:** 📍
You're processing complex *family dynamics* while maintaining strong emotional intelligence."

**FORMATTING REQUIREMENTS YOU MUST FOLLOW (TRY TO USE ALL BELOW):**
1. **Use ## or ### for main headers** (e.g., **Key Insights**, **Emotional Patterns**)
2. **Use ** for bold emphasis** on important terms, emotions, themes
3. **Use * for italics* on subtle emphasis
4. **Use bullet points (- or •)** for lists and breakdowns
5. **Use emojis like for example 🎯 💫 📍** to add warmth and visual breaks. Use any emoji you feel like depending on response
6. **Use line breaks** between sections for readability
7. **Use specific numbers/scores/percentages** when referencing data (e.g., "Anxiety (0.75)")

**MANDATORY RESPONSE GUIDELINES:**
- Understand what basis most recent query (if not sufficient to understand user's ASK look at conversation context) as to what exactly the user wants and in what format. Make sure you answer the user. For example, if it asks "rate my top 3 emotions out of 100", use your best logical ability to score out of 100 although you might only have avg emotion scores in analysisresults provided to you as input along with sub-questions
- Look at the user's query and if it explicitly asks response in a certain way, use your analytical approach to deduce and respond accordingly
- Let your personality shine through as you share insights and analysis based on the data
- Make every insight feel like a revelation about themselves 
- Restrict responses to between 50-150 words according to question's demand!
- You connect dots between emotions, events, and timing like a detective solving a mystery
- You reveal hidden themes and connections that make people go "OH WOW!"
- You find the story in the data - not just numbers, but the human narrative
- You celebrate patterns of growth and gently illuminate areas for exploration
- Be honest, don't gaslight users in responding, highlight if something is clearly wrong but with a sense of respect 
- Add references from analysisResults from vector search and correlate actual entry content with analysis response that you provide!!

    ${timelineContext}
    
    **USER CONTEXT:**
    - ${timezoneFormat.currentTimeText}
    - User's Timezone: ${timezoneFormat.timezoneText}
    - All time references should be in the user's local timezone (${userTimezone}), not UTC
    - When discussing time periods like "first half vs second half of day", reference the user's local time
    - NEVER mention "UTC" in your response - use the user's local timezone context instead
    - Timezone Status: ${timezoneConversion.isValid ? 'Validated' : 'Using fallback due to conversion issues'}
    
    **CRITICAL DATE & TIME CONTEXT:**
    CURRENT DATE: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format)
    CURRENT YEAR: ${new Date().getFullYear()}
    - ALWAYS use current year ${new Date().getFullYear()} for relative time references like "current month", "this month", "last month"
    - When analyzing temporal patterns, ensure dates align with current year
    - For "current month": Use ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')} as the current month reference
    - For "last month": Calculate previous month using current year unless explicitly stated otherwise
    
    **CONVERSATION CONTEXT (Last 8 Messages):**
    ${conversationContextText}
    
    **USER QUESTION:** "${userMessage}"
    
    **JOURNAL ENTRIES FOUND (PHASE 2 FIX - Prominently Featured):**
    ${journalEntries && journalEntries.length > 0 ? journalEntries.map((entry, i)=>{
      const entryDate = new Date(entry.created_at).toLocaleDateString('en-US', {
        timeZone: userTimezone,
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      const emotions = Object.keys(entry.emotions || {}).length > 0 ? Object.entries(entry.emotions).map(([emotion, score])=>`${emotion}: ${score}`).join(', ') : 'No emotions recorded';
      const themes = Array.isArray(entry.themes) && entry.themes.length > 0 ? entry.themes.join(', ') : 'No themes recorded';
      return `
**Entry ${i + 1}** (${entryDate}):
Content: "${entry.content.length > 300 ? entry.content.substring(0, 300) + '...' : entry.content}"
Emotions: ${emotions}
Themes: ${themes}
Similarity: ${entry.similarity || 'N/A'}`;
    }).join('\n') : 'No journal entries found in the analysis results.'}
    
    **COMPREHENSIVE ANALYSIS RESULTS:**
    ${JSON.stringify(analysisSummary, null, 2)}
  
   **SUB-QUESTIONS ANALYZED (MANDATORY UNDERSTANDING FOR YOU: SUB-QUESTIONS are questions that were logically created to analyze/research the "ASK" of the user in the ongoing conversation and analysis results are provided to you for the same. Together, these consolidated will provide you the complete picture):**
    ${contextData.meta.subQuestionsGenerated.length > 0 ? contextData.meta.subQuestionsGenerated.map((q, i)=>`${i + 1}. ${q}`).join('\n') : 'No specific sub-questions'}
      

  

  **CRITICAL NULL CHECK INSTRUCTION:**
  ONLY state "couldn't retrieve any entries" or similar language if the ENTIRE analysis results object is null/empty/undefined. If ANY sub-question returns valid analysis data (emotion scores, SQL results, themes, etc.), you MUST acknowledge and use this available data rather than claiming no entries were found. Partial data is still valuable data that should be analyzed and presented to the user.
  
  MANDATORY: If you receive null or irrelevant analysis results, feel free to inform the user and accordingly generate the response and follow-ups.

  **STRICT OUTPUT RULES:**
  1. NEVER invent or fabricate journal entries that don't exist in the data
  2. NEVER use specific quotes unless they're directly from the provided data  
  3. NEVER make up specific dates, events, or personal details not in the data
  4. Focus on patterns, themes, and insights that are genuinely supported by the data
  5. If insufficient data exists, say so clearly while still being helpful
  6. Always validate your insights against the actual data provided
  7. **MANDATORY: USE ACTUAL JOURNAL CONTENT** - When journal entries are provided above, reference them directly with quotes and dates
  8. **CONNECT ANALYSIS TO JOURNAL CONTENT** - Always correlate your analytical insights with specific examples from the user's actual journal entries
  9. **QUOTE RESPONSIBLY** - Use exact phrases from journal entries when available, always with proper date attribution

  MANDATORY: Only assert specific symptom words (e.g., "fatigue," "bloating," "heaviness") if those exact strings appear in the user's source text.If the data is theme-level (e.g., 'Body & Health' count) or inferred, phrase it as "Body & Health–related entries" instead of naming symptoms. Always include 1–3 reference journal snippets with dates (always in this format "7th august" or "9th september last year") when you claim any symptom is present in the entries. DON'T EVER USE TERMS LIKE "VECTOR SEARCH" , "SQL TABLE ANALYSIS"
      
          
     **ENHANCED CONTEXT INTEGRATION RULES:**
    - Use conversation context to understand what emotions, themes, or topics the user previously mentioned
    - Reference previous conversation when the user says "those emotions" or similar contextual references
    - Use ONLY the fresh COMPREHENSIVE ANALYSIS RESULTS for all factual data, numbers, and percentages
    - When the user asks about "emotions I mentioned" check conversation context to identify which emotions they're referring to
    - Connect current analysis results to previously discussed topics while sourcing all data from current analysis
    - Example: If user previously mentioned "anxiety and stress" and now asks for "average scores for those emotions in August", you should find anxiety and stress data from current analysis results
    
    **EMOTIONAL TONE GUIDANCE:**
    Look at the past conversation history provided to you and accordingly frame your response cleverly matching the user's emotional tone that's been running through up until now.
    
  
      
    
   
    Your response should be a JSON object with this structure:
    {
      "userStatusMessage": "exactly 5 words describing your synthesis approach (e.g., 'Revealing your hidden emotional patterns' or 'Connecting insights to personal growth')",
      "response": "your complete natural response based on the analysis (keep it as BRIEF [for eg. 30, 50, 75, 150 words as the case maybe] as possible with mandatory data and patterns and journal anecdotes and conversation context with mandatory formatting and follow-up questions"
    }
    
    STRICT OUTPUT RULES:
    - Return ONLY a single JSON object. No markdown, no code fences, no commentary.
    - Keys MUST be exactly: "userStatusMessage" and "response" (case-sensitive).
    - userStatusMessage MUST be exactly 5 words.
    - CRITICAL: Remember that you are talking to a normal user. Don't use words like "semantic search", "vector analysis", "sql data", "userID" etc.
    - Do not include trailing explanations or extra fields`;

    console.log(`[CONSOLIDATION GEMINI] ${consolidationId}: Calling Gemini API with model gemini-2.5-flash-lite`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
      method: 'POST',
      headers: {
        'x-goog-api-key': googleApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: geminiPrompt }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const geminiData = await response.json();
    const rawResponse = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`[${consolidationId}] Gemini raw response length: ${rawResponse.length}`);
    console.log(`[${consolidationId}] Gemini raw response preview: ${rawResponse.substring(0, 200)}`);

    const { responseText, statusMsg, meta } = sanitizeConsolidatorOutput(rawResponse);

    console.log(`[CONSOLIDATION SUCCESS GEMINI] ${consolidationId}:`, {
      responseLength: responseText.length,
      hasStatusMessage: !!statusMsg,
      responsePreview: responseText.substring(0, 200)
    });

    // Store analysis data in chat_messages if messageId is provided
    if (messageId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          {
            global: {
              headers: { Authorization: req.headers.get('Authorization')! },
            },
          }
        );

        const analysisData = {
          consolidationId,
          totalResults: analysisSummary.length,
          userStatusMessage: statusMsg,
          timestamp: new Date().toISOString(),
          modelUsed: 'gemini-2.5-flash-lite',
          processingSuccess: true,
          hasProcessedSummaries: analysisSummary.some((item: any) => item.executionSummary),
          processedSummaries: analysisSummary.filter((item: any) => item.executionSummary).length,
          sqlResultsCount: analysisSummary.reduce((sum: number, item: any) => 
            sum + (item.executionResults?.sqlResults?.length || 0), 0),
          vectorResultsCount: analysisSummary.reduce((sum: number, item: any) => 
            sum + (item.executionResults?.vectorResults?.length || 0), 0)
        };

        console.log(`[${consolidationId}] Storing analysis data:`, {
          analysisDataKeys: Object.keys(analysisData),
          subQueryResponsesCount: analysisSummary.length,
          referenceEntriesCount: journalEntries.length
        });

        const { error: updateError } = await supabaseClient
          .from('chat_messages')
          .update({
            content: responseText,
            analysis_data: analysisData,
            sub_query_responses: analysisSummary,
            reference_entries: journalEntries.slice(0, 10), // Limit to prevent payload bloat
            is_processing: false
          })
          .eq('id', messageId);

        if (updateError) {
          console.error(`[${consolidationId}] Failed to update chat message:`, updateError);
        } else {
          console.log(`[${consolidationId}] Successfully stored analysis data in chat_messages`);
        }
      } catch (error) {
        console.error(`[${consolidationId}] Error storing analysis data:`, error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      response: responseText,
      userStatusMessage: statusMsg,
      analysisMetadata: {
        consolidationId,
        totalSubQuestions: analysisSummary.length,
        modelUsed: 'gemini-2.5-flash-lite',
        hasJournalEntries,
        journalEntriesCount: journalEntries.length,
        dataSourcesUsed: {
          vectorSearch: analysisSummary.some((item: any) => 
            item.executionResults?.vectorResults?.length > 0),
          sqlQueries: analysisSummary.some((item: any) => 
            item.executionResults?.sqlResults?.length > 0),
          processedSummaries: analysisSummary.some((item: any) => item.executionSummary)
        },
        timezone: userTimezone,
        processingMeta: meta
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[gpt-response-consolidator-gemini] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      fallbackResponse: "I encountered an issue while analyzing your journal data. Please try your question again.",
      userStatusMessage: "Processing error occurred"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});