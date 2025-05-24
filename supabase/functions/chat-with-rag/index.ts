
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

// Create service client for database operations (bypasses RLS)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// JWT validation function
async function validateJWTAndGetUserId(authHeader: string): Promise<string | null> {
  try {
    const token = authHeader.replace('Bearer ', '');
    
    // Use service client to verify the JWT token
    const { data: { user }, error } = await supabaseService.auth.getUser(token);
    
    if (error || !user) {
      console.error('[chat-with-rag] JWT validation failed:', error);
      return null;
    }
    
    console.log(`[chat-with-rag] JWT validated successfully for user: ${user.id}`);
    return user.id;
  } catch (error) {
    console.error('[chat-with-rag] JWT validation exception:', error);
    return null;
  }
}

// Process individual sub-question
async function processSubQuestion(
  subQuestion: any,
  validatedUserId: string,
  effectiveDateFilter: any,
  strictDateEnforcement: boolean,
  openaiApiKey: string
) {
  console.log(`[chat-with-rag] Processing sub-question: "${subQuestion.question}"`);
  
  const searchPlan = subQuestion.searchPlan || {};
  const vectorSearch = searchPlan.vectorSearch || {};
  const sqlQueries = searchPlan.sqlQueries || [];
  
  // Individual containers for this sub-question
  const subQuestionEmotionResults = [];
  const subQuestionVectorResults = [];
  let hasEntriesInDateRange = true;

  // Check if we have entries in the date range for temporal queries
  if (effectiveDateFilter && strictDateEnforcement) {
    console.log(`[chat-with-rag] Checking entries in date range for sub-question: ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);
    
    try {
      const { count: entriesInRange, error } = await supabaseService
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', validatedUserId)
        .gte('created_at', effectiveDateFilter.startDate)
        .lte('created_at', effectiveDateFilter.endDate);

      if (error) {
        console.error(`[chat-with-rag] Error checking date range:`, error);
      } else {
        console.log(`[chat-with-rag] Found ${entriesInRange || 0} entries in date range for sub-question`);
        
        if (!entriesInRange || entriesInRange === 0) {
          console.log(`[chat-with-rag] NO ENTRIES in date range for this sub-question`);
          hasEntriesInDateRange = false;
          return {
            subQuestion: subQuestion.question,
            emotionResults: [],
            vectorResults: [],
            hasEntriesInDateRange: false,
            context: '',
            reasoning: 'No entries found in specified date range'
          };
        }
      }
    } catch (error) {
      console.error(`[chat-with-rag] Exception checking date range:`, error);
    }
  }

  // Execute SQL queries for this sub-question
  if (sqlQueries.length > 0) {
    console.log(`[chat-with-rag] Executing ${sqlQueries.length} SQL queries for sub-question`);
    
    for (const sqlQuery of sqlQueries) {
      try {
        let queryResult = null;
        
        // Apply time override to SQL parameters
        let sqlParams = { ...sqlQuery.parameters };
        
        if (effectiveDateFilter) {
          sqlParams.start_date = effectiveDateFilter.startDate;
          sqlParams.end_date = effectiveDateFilter.endDate;
        }
        
        if (sqlQuery.function === 'get_top_emotions_with_entries') {
          console.log(`[chat-with-rag] Calling get_top_emotions_with_entries for sub-question with params:`, {
            user_id_param: validatedUserId,
            start_date: sqlParams.start_date,
            end_date: sqlParams.end_date,
            limit_count: sqlParams.limit_count || 5
          });

          const { data, error } = await supabaseService.rpc(sqlQuery.function, {
            user_id_param: validatedUserId,
            start_date: sqlParams.start_date,
            end_date: sqlParams.end_date,
            limit_count: sqlParams.limit_count || 5
          });
          
          if (error) {
            console.error(`[chat-with-rag] SQL function error for ${sqlQuery.function}:`, error);
            throw error;
          }
          queryResult = data || [];
          console.log(`[chat-with-rag] SQL function ${sqlQuery.function} returned ${queryResult.length} results for sub-question`);
          
          // Store emotion results for this sub-question with unique keys
          if (queryResult && queryResult.length > 0) {
            queryResult.forEach((result, index) => {
              subQuestionEmotionResults.push({
                ...result,
                source: 'emotion_analysis',
                query_function: sqlQuery.function,
                unique_key: `emotion_${result.emotion}_${index}_${subQuestion.question}`,
                sub_question: subQuestion.question
              });
            });
            console.log(`[chat-with-rag] Added ${queryResult.length} emotion results for sub-question`);
          }
          
        } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
          console.log(`[chat-with-rag] Calling match_journal_entries_by_emotion for sub-question`);

          const { data, error } = await supabaseService.rpc(sqlQuery.function, {
            emotion_name: sqlParams.emotion_name,
            user_id_filter: validatedUserId,
            min_score: sqlParams.min_score || 0.3,
            start_date: sqlParams.start_date,
            end_date: sqlParams.end_date,
            limit_count: sqlParams.limit_count || 5
          });
          
          if (error) {
            console.error(`[chat-with-rag] SQL function error for ${sqlQuery.function}:`, error);
            throw error;
          }
          queryResult = data || [];
          console.log(`[chat-with-rag] SQL function ${sqlQuery.function} returned ${queryResult.length} results for sub-question`);
          
          // Store as vector results since these are specific entries
          if (queryResult && queryResult.length > 0) {
            subQuestionVectorResults.push(...queryResult.map(result => ({
              ...result,
              source: 'sql_query',
              query_function: sqlQuery.function,
              sub_question: subQuestion.question
            })));
            console.log(`[chat-with-rag] Added ${queryResult.length} results from SQL query for sub-question`);
          }
        }
        
      } catch (error) {
        console.error(`[chat-with-rag] Error executing SQL query ${sqlQuery.function} for sub-question:`, error);
      }
    }
  }

  // Execute vector search for this sub-question if enabled
  if (vectorSearch.enabled) {
    try {
      console.log(`[chat-with-rag] Executing vector search for sub-question: "${vectorSearch.query || subQuestion.question}"`);
      
      // Generate embedding for the search query
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: vectorSearch.query || subQuestion.question,
          model: 'text-embedding-ada-002',
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Perform vector search with service client
      let vectorSearchResults = [];
      
      if (effectiveDateFilter) {
        console.log(`[chat-with-rag] Vector search with date filter for sub-question`);
        const { data, error } = await supabaseService.rpc('match_journal_entries_with_date', {
          query_embedding: embedding,
          match_threshold: vectorSearch.threshold || 0.1,
          match_count: 10,
          user_id_filter: validatedUserId,
          start_date: effectiveDateFilter.startDate,
          end_date: effectiveDateFilter.endDate
        });
        
        if (error) {
          console.error(`[chat-with-rag] Vector search with date error for sub-question:`, error);
          throw error;
        }
        vectorSearchResults = data || [];
        
      } else {
        console.log(`[chat-with-rag] Vector search without date filter for sub-question`);
        const { data, error } = await supabaseService.rpc('match_journal_entries_fixed', {
          query_embedding: embedding,
          match_threshold: vectorSearch.threshold || 0.1,
          match_count: 10,
          user_id_filter: validatedUserId
        });
        
        if (error) {
          console.error(`[chat-with-rag] Vector search error for sub-question:`, error);
          throw error;
        }
        vectorSearchResults = data || [];
      }

      console.log(`[chat-with-rag] Vector search returned ${vectorSearchResults.length} results for sub-question`);

      if (vectorSearchResults.length > 0) {
        subQuestionVectorResults.push(...vectorSearchResults.map(result => ({
          ...result,
          source: 'vector_search',
          similarity: result.similarity,
          sub_question: subQuestion.question
        })));
      }

    } catch (error) {
      console.error(`[chat-with-rag] Error in vector search for sub-question:`, error);
    }
  }

  // Prepare context for this specific sub-question
  let subQuestionContext = '';
  
  // Check if this sub-question is emotion-focused
  const isEmotionQuery = subQuestion.question.toLowerCase().includes('emotion') || subQuestionEmotionResults.length > 0;
  
  if (isEmotionQuery && subQuestionEmotionResults.length > 0) {
    // Enhanced emotion data formatting for this sub-question
    subQuestionContext = `**EMOTION ANALYSIS for "${subQuestion.question}":**\n\n`;
    subQuestionContext += "Pre-computed emotion scores (0.0-1.0 scale) from AI analysis:\n\n";
    
    subQuestionEmotionResults.forEach((result, index) => {
      const emotionName = result.emotion.toUpperCase();
      const score = parseFloat(result.score).toFixed(3);
      const frequency = result.sample_entries ? result.sample_entries.length : 0;
      
      subQuestionContext += `**${index + 1}. ${emotionName}**\n`;
      subQuestionContext += `   • Score: ${score}/1.0\n`;
      subQuestionContext += `   • Frequency: Found in ${frequency} entries\n`;
      
      if (result.sample_entries && Array.isArray(result.sample_entries)) {
        subQuestionContext += `   • Sample entries with this emotion:\n`;
        result.sample_entries.slice(0, 2).forEach((entry, entryIndex) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const preview = entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '');
          subQuestionContext += `     ${entryIndex + 1}. ${date}: "${preview}" (Score: ${entry.score})\n`;
        });
      }
      subQuestionContext += "\n";
    });
    
    // Add supporting vector search results
    if (subQuestionVectorResults.length > 0) {
      subQuestionContext += "\n**SUPPORTING CONTEXT:**\n";
      subQuestionVectorResults.slice(0, 3).forEach((entry, index) => {
        const date = new Date(entry.created_at).toLocaleDateString();
        const preview = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');
        subQuestionContext += `${index + 1}. ${date}: ${preview}\n`;
      });
    }
  } else {
    // Standard formatting for non-emotion sub-questions
    const allSubQuestionResults = [...subQuestionEmotionResults, ...subQuestionVectorResults];
    
    if (allSubQuestionResults.length > 0) {
      subQuestionContext = `**CONTEXT for "${subQuestion.question}":**\n\n`;
      subQuestionContext += allSubQuestionResults.map(entry => {
        const content = entry.content || entry.sample_entries?.[0]?.content || 'No content available';
        const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Unknown date';
        const emotions = entry.emotions ? Object.keys(entry.emotions).slice(0, 3).join(', ') : 'No emotions detected';
        
        return `Date: ${date}\nContent: ${content.substring(0, 300)}...\nEmotions: ${emotions}`;
      }).join('\n\n---\n\n');
    }
  }

  return {
    subQuestion: subQuestion.question,
    emotionResults: subQuestionEmotionResults,
    vectorResults: subQuestionVectorResults,
    hasEntriesInDateRange,
    context: subQuestionContext,
    reasoning: subQuestion.reasoning || 'Analysis completed',
    totalResults: subQuestionEmotionResults.length + subQuestionVectorResults.length
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log(`[chat-with-rag] Auth header present: ${!!authHeader}`);
    
    if (!authHeader) {
      console.error('[chat-with-rag] No authorization header provided');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate JWT token and extract user ID
    const validatedUserId = await validateJWTAndGetUserId(authHeader);
    
    if (!validatedUserId) {
      console.error('[chat-with-rag] JWT validation failed');
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      message, 
      userId, 
      queryPlan, 
      conversationContext = [],
      useAllEntries = false,
      hasPersonalPronouns = false,
      hasExplicitTimeReference = false
    } = await req.json();

    console.log(`[chat-with-rag] PROCESSING: "${message}"`);
    console.log(`[chat-with-rag] Flags - UseAllEntries: ${useAllEntries}, PersonalPronouns: ${hasPersonalPronouns}, TimeRef: ${hasExplicitTimeReference}`);
    console.log(`[chat-with-rag] Validated userId: ${validatedUserId} (type: ${typeof validatedUserId})`);
    console.log(`[chat-with-rag] Request userId: ${userId} (type: ${typeof userId})`);

    // Verify that the userId from request matches the validated JWT user
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    if (userIdString !== validatedUserId) {
      console.error('[chat-with-rag] User ID mismatch between request and JWT');
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!message || !userId || !queryPlan) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check user's journal entry count using service client
    console.log(`[chat-with-rag] Checking journal entries for user: ${validatedUserId}`);
    
    let userEntryCount = 0;
    try {
      const { count, error: countError } = await supabaseService
        .from('Journal Entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', validatedUserId);

      if (countError) {
        console.error(`[chat-with-rag] Error counting entries:`, countError);
        userEntryCount = 0;
      } else {
        userEntryCount = count || 0;
        console.log(`[chat-with-rag] Successfully counted ${userEntryCount} entries for user ${validatedUserId}`);
      }
    } catch (error) {
      console.error(`[chat-with-rag] Exception counting entries:`, error);
      userEntryCount = 0;
    }

    // Only return "no entries" if we're absolutely certain
    if (userEntryCount === 0) {
      console.log(`[chat-with-rag] Confirmed: No journal entries found for user ${validatedUserId}`);
      return new Response(JSON.stringify({
        response: "I'd love to help you analyze your journal entries, but it looks like you haven't created any entries yet. Once you start journaling, I'll be able to provide insights about your emotions, patterns, and personal growth!",
        hasData: false,
        entryCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process sub-questions individually with enhanced time override logic
    console.log(`[chat-with-rag] Processing ${queryPlan.subQuestions?.length || 0} sub-questions individually`);
    
    const strictDateEnforcement = !useAllEntries && hasExplicitTimeReference;
    console.log(`[chat-with-rag] Strict date enforcement: ${strictDateEnforcement}`);

    // Store individual sub-question results
    const subQuestionAnalyses = [];
    let hasAnyEntriesInDateRange = false;

    for (const subQuestion of queryPlan.subQuestions || []) {
      // Apply time override logic for each sub-question
      let effectiveDateFilter = subQuestion.searchPlan?.vectorSearch?.dateFilter;
      
      if (useAllEntries && hasPersonalPronouns && !hasExplicitTimeReference) {
        effectiveDateFilter = null;
        console.log(`[chat-with-rag] TIME OVERRIDE: Removing date filter for personal query in sub-question`);
      } else if (effectiveDateFilter) {
        console.log(`[chat-with-rag] Applying date filter for sub-question: ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);
      }

      // Process this individual sub-question
      const subQuestionResult = await processSubQuestion(
        subQuestion,
        validatedUserId,
        effectiveDateFilter,
        strictDateEnforcement,
        openaiApiKey
      );

      subQuestionAnalyses.push(subQuestionResult);
      
      if (subQuestionResult.hasEntriesInDateRange) {
        hasAnyEntriesInDateRange = true;
      }

      console.log(`[chat-with-rag] Sub-question "${subQuestion.question}" completed with ${subQuestionResult.totalResults} total results`);
    }

    // Handle case where no entries found due to strict date enforcement across all sub-questions
    if (strictDateEnforcement && !hasAnyEntriesInDateRange) {
      console.log(`[chat-with-rag] STRICT DATE ENFORCEMENT: No entries in specified date range across all sub-questions`);
      
      const temporalContext = queryPlan.dateRange ? 
        ` from ${new Date(queryPlan.dateRange.startDate).toLocaleDateString()} to ${new Date(queryPlan.dateRange.endDate).toLocaleDateString()}` : 
        ' in the specified time period';
        
      return new Response(JSON.stringify({
        response: `I don't see any journal entries${temporalContext}. You might want to try a different time period, or if you haven't been journaling during that time, that's completely normal! Would you like me to look at a broader time range or help you with something else?`,
        hasData: false,
        searchedTimeRange: queryPlan.dateRange,
        strictDateEnforcement: true,
        entryCount: userEntryCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate total results across all sub-questions
    const totalEmotionResults = subQuestionAnalyses.reduce((sum, analysis) => sum + analysis.emotionResults.length, 0);
    const totalVectorResults = subQuestionAnalyses.reduce((sum, analysis) => sum + analysis.vectorResults.length, 0);
    const totalResults = totalEmotionResults + totalVectorResults;

    if (totalResults === 0) {
      console.log(`[chat-with-rag] No results found after processing all sub-questions individually`);
      
      let fallbackResponse;
      
      if (useAllEntries && hasPersonalPronouns) {
        fallbackResponse = "I'd love to help analyze your personal patterns, but I'm having trouble finding relevant entries right now. This might be because your journal entries don't contain the specific topics we're looking for, or there might be a technical issue. Could you try rephrasing your question or asking about something more specific?";
      } else {
        fallbackResponse = "I couldn't find any journal entries that match your query. This could be because you haven't journaled about this topic yet, or the entries don't contain similar content. Would you like to try asking about something else or rephrase your question?";
      }
      
      return new Response(JSON.stringify({
        response: fallbackResponse,
        hasData: false,
        entryCount: userEntryCount,
        useAllEntries,
        hasPersonalPronouns
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if this is an emotion-focused query
    const isEmotionQuery = queryPlan.isEmotionQuery || message.toLowerCase().includes('emotion');
    
    // Prepare comprehensive context for GPT with individual sub-question analyses
    let journalContext = '';
    
    if (subQuestionAnalyses.length > 1) {
      // Multi-question query - structure by sub-question
      journalContext = "**MULTI-QUESTION ANALYSIS**\n\n";
      journalContext += "The user asked a multi-part question. Below is the individual analysis for each part:\n\n";
      
      subQuestionAnalyses.forEach((analysis, index) => {
        journalContext += `## SUB-QUESTION ${index + 1}: "${analysis.subQuestion}"\n\n`;
        
        if (analysis.context.length > 0) {
          journalContext += analysis.context + "\n\n";
        } else {
          journalContext += "No specific data found for this sub-question.\n\n";
        }
        
        journalContext += `**Sub-question Summary:** ${analysis.reasoning}\n`;
        journalContext += `**Results Count:** ${analysis.emotionResults.length} emotion results, ${analysis.vectorResults.length} entry results\n\n`;
        journalContext += "---\n\n";
      });
      
      journalContext += "**SYNTHESIS INSTRUCTIONS:**\n";
      journalContext += "1. Address each sub-question individually first\n";
      journalContext += "2. Then provide cross-analysis and patterns between sub-questions\n";
      journalContext += "3. Synthesize insights that span multiple sub-questions\n";
      journalContext += "4. Provide a comprehensive conclusion that addresses the overall query\n\n";
      
    } else {
      // Single question - use the analysis directly
      const analysis = subQuestionAnalyses[0];
      journalContext = analysis.context;
    }

    // Enhanced system prompt for multi-question processing
    const systemPrompt = `You are SOULo, a compassionate AI assistant that helps users understand their journal entries and emotional patterns.

Context: The user has ${userEntryCount} total journal entries. ${useAllEntries ? 'You are analyzing ALL their entries for comprehensive personal insights.' : `You are analyzing ${totalResults} relevant results across ${subQuestionAnalyses.length} sub-question(s).`}

${hasPersonalPronouns ? 'IMPORTANT: This is a personal question about the user themselves. Provide personalized insights and speak directly to them about their patterns, growth, and experiences.' : ''}

${hasExplicitTimeReference ? `IMPORTANT: This query is specifically about ${queryPlan.dateRange ? `the time period from ${new Date(queryPlan.dateRange.startDate).toLocaleDateString()} to ${new Date(queryPlan.dateRange.endDate).toLocaleDateString()}` : 'a specific time period'}. Focus your analysis on that timeframe.` : ''}

${subQuestionAnalyses.length > 1 ? `**MULTI-QUESTION PROCESSING:**
You are handling a multi-part query with ${subQuestionAnalyses.length} sub-questions. Each sub-question has been analyzed separately and the results are structured below. Your task is to:
1. Address each sub-question individually using its specific analysis
2. Identify patterns and connections across sub-questions  
3. Provide synthesis insights that span multiple parts of the query
4. Give a comprehensive response that addresses the overall multi-part question` : ''}

${isEmotionQuery ? `**CRITICAL EMOTION ANALYSIS INSTRUCTIONS:**
• You have access to PRE-CALCULATED emotion scores from the database (0.0 to 1.0 scale)
• These scores were generated by advanced AI analysis of the journal content
• DO NOT attempt to infer emotions from the text snippets - use ONLY the provided scores
• Focus on quantitative analysis: patterns, frequencies, score distributions, and trends
• The emotion scores represent the intensity/strength of each emotion detected
• Analyze relationships between emotions based on their numerical values
• When you see "Score: 0.842" this means that emotion was detected with 84.2% intensity
• For co-occurrence analysis, look at which emotions appear together in the same entries
• NEVER say "your entries don't explicitly mention emotions" - the emotions are already calculated and scored` : ''}

Based on these journal entries and analyses, provide a helpful, warm, and insightful response to: "${message}"

Journal Data and Analysis:
${journalContext}

FORMATTING REQUIREMENTS - YOU MUST FOLLOW THESE:
- Structure your response with clear markdown headers using ## for main sections
- Use **bold text** for key insights, emotions, and important points
- Organize information with bullet points using - for lists
- Break content into digestible sections with descriptive headers
- Make the response visually scannable and well-organized
- Use markdown formatting consistently throughout
${subQuestionAnalyses.length > 1 ? '- Start by addressing each sub-question individually, then provide synthesis' : ''}

Guidelines:
- Be warm, empathetic, and supportive
- Provide specific insights based on the actual data provided
- ${hasPersonalPronouns ? 'Use "you" and "your" to make it personal since they asked about themselves' : 'Keep the tone conversational but not overly personal'}
- If patterns emerge, point them out constructively using bullet points
- ${useAllEntries ? 'Since you have access to their full journal history, provide comprehensive insights about long-term patterns' : 'Focus on the specific entries provided'}
- End with an encouraging note or helpful suggestion
- Structure everything with proper markdown headers and bullet points for easy reading
${subQuestionAnalyses.length > 1 ? '- Ensure each sub-question gets adequate attention before moving to synthesis' : ''}`;

    try {
      const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
          max_tokens: 1500,
        }),
      });

      if (!gptResponse.ok) {
        throw new Error(`OpenAI API error: ${gptResponse.status}`);
      }

      const gptData = await gptResponse.json();
      const response = gptData.choices[0].message.content;

      console.log(`[chat-with-rag] Successfully generated response with ${subQuestionAnalyses.length} sub-question analyses, ${totalEmotionResults} emotion results and ${totalVectorResults} vector results`);

      return new Response(JSON.stringify({
        response,
        hasData: true,
        entryCount: totalResults,
        emotionResultsCount: totalEmotionResults,
        vectorResultsCount: totalVectorResults,
        totalUserEntries: userEntryCount,
        subQuestionCount: subQuestionAnalyses.length,
        subQuestionAnalyses: subQuestionAnalyses.map(analysis => ({
          question: analysis.subQuestion,
          emotionResults: analysis.emotionResults.length,
          vectorResults: analysis.vectorResults.length,
          hasData: analysis.totalResults > 0
        })),
        useAllEntries,
        hasPersonalPronouns,
        strictDateEnforcement,
        analyzedTimeRange: queryPlan.dateRange,
        processingFlags: {
          useAllEntries,
          hasPersonalPronouns,
          hasExplicitTimeReference,
          strictDateEnforcement,
          isMultiQuestion: subQuestionAnalyses.length > 1
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[chat-with-rag] Error calling OpenAI:', error);
      return new Response(JSON.stringify({
        error: 'Failed to generate response',
        hasData: totalResults > 0,
        entryCount: totalResults
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('[chat-with-rag] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
