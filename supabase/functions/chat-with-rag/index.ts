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
      // Use service client with explicit user_id filter - UUID passed directly
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

    // If no entries found, try a direct query for debugging
    if (userEntryCount === 0) {
      console.log(`[chat-with-rag] Double-checking entries with direct query for user: ${validatedUserId}...`);
      try {
        const { data: entries, error } = await supabaseService
          .from('Journal Entries')
          .select('id, created_at, user_id, emotions')
          .eq('user_id', validatedUserId)
          .limit(5);

        if (error) {
          console.error(`[chat-with-rag] Error in double-check query:`, error);
        } else if (entries && entries.length > 0) {
          console.log(`[chat-with-rag] Double-check found ${entries.length} entries! Sample:`, 
            entries.map(e => ({ 
              id: e.id, 
              user_id: e.user_id, 
              user_id_type: typeof e.user_id,
              created_at: e.created_at,
              has_emotions: !!e.emotions 
            })));
          userEntryCount = entries.length;
        } else {
          console.log(`[chat-with-rag] Double-check also returned 0 entries for user: ${validatedUserId}`);
        }
      } catch (error) {
        console.error(`[chat-with-rag] Exception in double-check:`, error);
      }
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

    // Execute sub-questions with enhanced time override logic
    console.log(`[chat-with-rag] Executing ${queryPlan.subQuestions?.length || 0} sub-questions`);
    
    // Separate containers for different types of results
    const emotionResults = [];
    const vectorResults = [];
    const strictDateEnforcement = !useAllEntries && hasExplicitTimeReference;
    let hasEntriesInDateRange = true;

    console.log(`[chat-with-rag] Strict date enforcement: ${strictDateEnforcement}`);

    for (const subQuestion of queryPlan.subQuestions || []) {
      console.log(`[chat-with-rag] Executing sub-question: "${subQuestion.question}"`);
      
      const searchPlan = subQuestion.searchPlan || {};
      const vectorSearch = searchPlan.vectorSearch || {};
      const sqlQueries = searchPlan.sqlQueries || [];
      
      // Apply time override logic
      let effectiveDateFilter = vectorSearch.dateFilter;
      
      if (useAllEntries && hasPersonalPronouns && !hasExplicitTimeReference) {
        effectiveDateFilter = null;
        console.log(`[chat-with-rag] TIME OVERRIDE: Removing date filter for personal query`);
      } else if (effectiveDateFilter) {
        console.log(`[chat-with-rag] Applying date filter: ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);
      }

      // Check if we have entries in the date range for temporal queries
      if (effectiveDateFilter && strictDateEnforcement) {
        console.log(`[chat-with-rag] Checking entries in date range: ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);
        
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
            console.log(`[chat-with-rag] Found ${entriesInRange || 0} entries in date range for user ${validatedUserId}`);
            
            if (!entriesInRange || entriesInRange === 0) {
              console.log(`[chat-with-rag] NO ENTRIES in date range - continuing to next sub-question`);
              hasEntriesInDateRange = false;
              continue;
            }
          }
        } catch (error) {
          console.error(`[chat-with-rag] Exception checking date range:`, error);
        }
      }

      // Execute SQL queries if any
      if (sqlQueries.length > 0) {
        console.log(`[chat-with-rag] Executing ${sqlQueries.length} SQL queries`);
        
        for (const sqlQuery of sqlQueries) {
          try {
            let queryResult = null;
            
            // Apply time override to SQL parameters
            let sqlParams = { ...sqlQuery.parameters };
            
            if (useAllEntries && hasPersonalPronouns && !hasExplicitTimeReference) {
              sqlParams.start_date = null;
              sqlParams.end_date = null;
              console.log(`[chat-with-rag] TIME OVERRIDE: Removing SQL date constraints`);
            } else if (effectiveDateFilter) {
              sqlParams.start_date = effectiveDateFilter.startDate;
              sqlParams.end_date = effectiveDateFilter.endDate;
            }
            
            if (sqlQuery.function === 'get_top_emotions_with_entries') {
              console.log(`[chat-with-rag] Calling get_top_emotions_with_entries with params:`, {
                user_id_param: validatedUserId,
                user_id_param_type: typeof validatedUserId,
                start_date: sqlParams.start_date,
                end_date: sqlParams.end_date,
                limit_count: sqlParams.limit_count || 5
              });

              // Use service client for SQL functions - pass UUID directly
              const { data, error } = await supabaseService.rpc(sqlQuery.function, {
                user_id_param: validatedUserId, // UUID passed directly
                start_date: sqlParams.start_date,
                end_date: sqlParams.end_date,
                limit_count: sqlParams.limit_count || 5
              });
              
              if (error) {
                console.error(`[chat-with-rag] SQL function error for ${sqlQuery.function}:`, {
                  error: error,
                  message: error.message,
                  details: error.details,
                  hint: error.hint,
                  code: error.code
                });
                throw error;
              }
              queryResult = data || [];
              console.log(`[chat-with-rag] SQL function ${sqlQuery.function} returned ${queryResult.length} results`);
              
              // Store emotion results separately with unique keys
              if (queryResult && queryResult.length > 0) {
                queryResult.forEach((result, index) => {
                  emotionResults.push({
                    ...result,
                    source: 'emotion_analysis',
                    query_function: sqlQuery.function,
                    unique_key: `emotion_${result.emotion}_${index}` // Unique key for emotions
                  });
                });
                console.log(`[chat-with-rag] Added ${queryResult.length} emotion results from SQL query ${sqlQuery.function}`);
              }
              
            } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
              console.log(`[chat-with-rag] Calling match_journal_entries_by_emotion with params:`, {
                emotion_name: sqlParams.emotion_name,
                user_id_filter: validatedUserId,
                user_id_filter_type: typeof validatedUserId,
                min_score: sqlParams.min_score || 0.3,
                start_date: sqlParams.start_date,
                end_date: sqlParams.end_date,
                limit_count: sqlParams.limit_count || 5
              });

              const { data, error } = await supabaseService.rpc(sqlQuery.function, {
                emotion_name: sqlParams.emotion_name,
                user_id_filter: validatedUserId, // UUID passed directly (FIXED!)
                min_score: sqlParams.min_score || 0.3,
                start_date: sqlParams.start_date,
                end_date: sqlParams.end_date,
                limit_count: sqlParams.limit_count || 5
              });
              
              if (error) {
                console.error(`[chat-with-rag] SQL function error for ${sqlQuery.function}:`, {
                  error: error,
                  message: error.message,
                  details: error.details,
                  hint: error.hint,
                  code: error.code
                });
                throw error;
              }
              queryResult = data || [];
              console.log(`[chat-with-rag] SQL function ${sqlQuery.function} returned ${queryResult.length} results`);
              
              // Store as vector results since these are specific entries
              if (queryResult && queryResult.length > 0) {
                vectorResults.push(...queryResult.map(result => ({
                  ...result,
                  source: 'sql_query',
                  query_function: sqlQuery.function
                })));
                console.log(`[chat-with-rag] Added ${queryResult.length} results from SQL query ${sqlQuery.function}`);
              }
            }
            
          } catch (error) {
            console.error(`[chat-with-rag] Error executing SQL query ${sqlQuery.function}:`, {
              error: error,
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
          }
        }
      }

      // Execute vector search if enabled
      if (vectorSearch.enabled) {
        try {
          console.log(`[chat-with-rag] Executing vector search for: "${vectorSearch.query || subQuestion.question}"`);
          
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
            console.log(`[chat-with-rag] Vector search with date filter for user: ${validatedUserId}`);
            const { data, error } = await supabaseService.rpc('match_journal_entries_with_date', {
              query_embedding: embedding,
              match_threshold: vectorSearch.threshold || 0.1,
              match_count: 10,
              user_id_filter: validatedUserId, // UUID passed directly
              start_date: effectiveDateFilter.startDate,
              end_date: effectiveDateFilter.endDate
            });
            
            if (error) {
              console.error(`[chat-with-rag] Vector search with date error:`, error);
              throw error;
            }
            vectorSearchResults = data || [];
            
          } else {
            console.log(`[chat-with-rag] Vector search without date filter for user: ${validatedUserId}`);
            const { data, error } = await supabaseService.rpc('match_journal_entries_fixed', {
              query_embedding: embedding,
              match_threshold: vectorSearch.threshold || 0.1,
              match_count: useAllEntries ? 50 : 10,
              user_id_filter: validatedUserId // UUID passed directly
            });
            
            if (error) {
              console.error(`[chat-with-rag] Vector search error:`, error);
              throw error;
            }
            vectorSearchResults = data || [];
          }

          console.log(`[chat-with-rag] Vector search returned ${vectorSearchResults.length} results`);

          if (vectorSearchResults.length > 0) {
            vectorResults.push(...vectorSearchResults.map(result => ({
              ...result,
              source: 'vector_search',
              similarity: result.similarity
            })));
          }

        } catch (error) {
          console.error(`[chat-with-rag] Error in vector search:`, error);
        }
      }
    }

    // Combine results with proper deduplication for vector results only
    const uniqueVectorResults = Array.from(
      new Map(vectorResults.map(item => [item.id, item])).values()
    ).slice(0, useAllEntries ? 100 : 15);

    // Keep ALL emotion results since they're unique by emotion name
    const allResults = [...emotionResults, ...uniqueVectorResults];

    console.log(`[chat-with-rag] Retrieved ${emotionResults.length} emotion results and ${uniqueVectorResults.length} vector results`);

    // Handle case where no entries found due to strict date enforcement
    if (strictDateEnforcement && !hasEntriesInDateRange) {
      console.log(`[chat-with-rag] STRICT DATE ENFORCEMENT: No entries in specified date range`);
      
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

    if (allResults.length === 0) {
      console.log(`[chat-with-rag] No results found after processing all sub-questions`);
      
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
    
    // Prepare context for GPT with enhanced emotion handling
    let journalContext = '';
    
    if (isEmotionQuery && emotionResults.length > 0) {
      // **ENHANCED EMOTION DATA FORMATTING**
      journalContext = "**PRE-CALCULATED EMOTION ANALYSIS (Database Scores):**\n\n";
      journalContext += "Note: These are pre-computed emotion scores (0.0-1.0 scale) from AI analysis of journal content.\n\n";
      
      emotionResults.forEach((result, index) => {
        const emotionName = result.emotion.toUpperCase();
        const score = parseFloat(result.score).toFixed(3);
        const frequency = result.sample_entries ? result.sample_entries.length : 0;
        
        journalContext += `**${index + 1}. ${emotionName}**\n`;
        journalContext += `   • Score: ${score}/1.0\n`;
        journalContext += `   • Frequency: Found in ${frequency} entries\n`;
        
        if (result.sample_entries && Array.isArray(result.sample_entries)) {
          journalContext += `   • Sample entries with this emotion:\n`;
          result.sample_entries.slice(0, 2).forEach((entry, entryIndex) => {
            const date = new Date(entry.created_at).toLocaleDateString();
            const preview = entry.content.substring(0, 100) + (entry.content.length > 100 ? '...' : '');
            journalContext += `     ${entryIndex + 1}. ${date}: "${preview}" (Score: ${entry.score})\n`;
          });
        }
        journalContext += "\n";
      });
      
      // Add supporting vector search results as supplementary context
      if (uniqueVectorResults.length > 0) {
        journalContext += "\n**SUPPORTING CONTEXT (Additional Journal Entries):**\n";
        journalContext += "Note: These entries provide additional context but emotion analysis should focus on the scores above.\n\n";
        uniqueVectorResults.slice(0, 3).forEach((entry, index) => {
          const date = new Date(entry.created_at).toLocaleDateString();
          const preview = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');
          journalContext += `${index + 1}. ${date}: ${preview}\n`;
        });
      }
    } else {
      // Standard formatting for non-emotion queries
      journalContext = allResults.map(entry => {
        const content = entry.content || entry.sample_entries?.[0]?.content || 'No content available';
        const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Unknown date';
        const emotions = entry.emotions ? Object.keys(entry.emotions).slice(0, 3).join(', ') : 'No emotions detected';
        
        return `Date: ${date}\nContent: ${content.substring(0, 300)}...\nEmotions: ${emotions}`;
      }).join('\n\n---\n\n');
    }

    const systemPrompt = `You are SOULo, a compassionate AI assistant that helps users understand their journal entries and emotional patterns.

Context: The user has ${userEntryCount} total journal entries. ${useAllEntries ? 'You are analyzing ALL their entries for comprehensive personal insights.' : `You are analyzing ${allResults.length} relevant entries.`}

${hasPersonalPronouns ? 'IMPORTANT: This is a personal question about the user themselves. Provide personalized insights and speak directly to them about their patterns, growth, and experiences.' : ''}

${hasExplicitTimeReference ? `IMPORTANT: This query is specifically about ${queryPlan.dateRange ? `the time period from ${new Date(queryPlan.dateRange.startDate).toLocaleDateString()} to ${new Date(queryPlan.dateRange.endDate).toLocaleDateString()}` : 'a specific time period'}. Focus your analysis on that timeframe.` : ''}

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

Based on these journal entries, provide a helpful, warm, and insightful response to: "${message}"

Journal Data:
${journalContext}

FORMATTING REQUIREMENTS - YOU MUST FOLLOW THESE:
- Structure your response with clear markdown headers using ## for main sections
- Use **bold text** for key insights, emotions, and important points
- Organize information with bullet points using - for lists
- Break content into digestible sections with descriptive headers
- Make the response visually scannable and well-organized
- Use markdown formatting consistently throughout

Guidelines:
- Be warm, empathetic, and supportive
- Provide specific insights based on the actual data provided
- ${hasPersonalPronouns ? 'Use "you" and "your" to make it personal since they asked about themselves' : 'Keep the tone conversational but not overly personal'}
- If patterns emerge, point them out constructively using bullet points
- ${useAllEntries ? 'Since you have access to their full journal history, provide comprehensive insights about long-term patterns' : 'Focus on the specific entries provided'}
- End with an encouraging note or helpful suggestion
- Structure everything with proper markdown headers and bullet points for easy reading`;

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
          max_tokens: 1000,
        }),
      });

      if (!gptResponse.ok) {
        throw new Error(`OpenAI API error: ${gptResponse.status}`);
      }

      const gptData = await gptResponse.json();
      const response = gptData.choices[0].message.content;

      console.log(`[chat-with-rag] Successfully generated response with ${emotionResults.length} emotion results and ${uniqueVectorResults.length} vector results`);

      return new Response(JSON.stringify({
        response,
        hasData: true,
        entryCount: allResults.length,
        emotionResultsCount: emotionResults.length,
        vectorResultsCount: uniqueVectorResults.length,
        totalUserEntries: userEntryCount,
        useAllEntries,
        hasPersonalPronouns,
        strictDateEnforcement,
        analyzedTimeRange: queryPlan.dateRange,
        processingFlags: {
          useAllEntries,
          hasPersonalPronouns,
          hasExplicitTimeReference,
          strictDateEnforcement
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[chat-with-rag] Error calling OpenAI:', error);
      return new Response(JSON.stringify({
        error: 'Failed to generate response',
        hasData: allResults.length > 0,
        entryCount: allResults.length
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
