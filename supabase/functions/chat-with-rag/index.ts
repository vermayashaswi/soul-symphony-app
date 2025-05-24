
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { planQuery, shouldUseComprehensiveSearch, getMaxEntries } from "./utils/queryPlanner.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      message, 
      userId, 
      queryPlan, 
      conversationContext = [],
      useAllEntries = false,  // NEW: Accept this flag from the planner
      hasPersonalPronouns = false,  // NEW: Accept this flag
      hasExplicitTimeReference = false  // NEW: Accept this flag
    } = await req.json();

    console.log(`[chat-with-rag] ENHANCED PROCESSING with time override logic: "${message}"`);
    console.log(`[chat-with-rag] Flags - UseAllEntries: ${useAllEntries}, PersonalPronouns: ${hasPersonalPronouns}, TimeRef: ${hasExplicitTimeReference}`);

    if (!message || !userId || !queryPlan) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check user's journal entry count
    const { count: userEntryCount } = await supabase
      .from('Journal Entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    console.log(`[chat-with-rag] User has ${userEntryCount || 0} journal entries available`);

    if (!userEntryCount || userEntryCount === 0) {
      return new Response(JSON.stringify({
        response: "I'd love to help you analyze your journal entries, but it looks like you haven't created any entries yet. Once you start journaling, I'll be able to provide insights about your emotions, patterns, and personal growth!",
        hasData: false,
        entryCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Execute sub-questions with enhanced time override logic
    console.log(`[chat-with-rag] Executing ${queryPlan.subQuestions?.length || 0} sub-questions with time override enforcement`);
    
    const allResults = [];
    const strictDateEnforcement = !useAllEntries && hasExplicitTimeReference;
    let hasEntriesInDateRange = true;

    console.log(`[chat-with-rag] Strict date enforcement: ${strictDateEnforcement}`);

    for (const subQuestion of queryPlan.subQuestions || []) {
      console.log(`[chat-with-rag] Executing sub-question: "${subQuestion.question}"`);
      
      const searchPlan = subQuestion.searchPlan || {};
      const vectorSearch = searchPlan.vectorSearch || {};
      const sqlQueries = searchPlan.sqlQueries || [];
      
      // CRITICAL: Apply time override logic
      let effectiveDateFilter = vectorSearch.dateFilter;
      
      if (useAllEntries && hasPersonalPronouns && !hasExplicitTimeReference) {
        // Override: Remove date constraints for personal pronoun queries without time references
        effectiveDateFilter = null;
        console.log(`[chat-with-rag] TIME OVERRIDE: Removing date filter for personal query without time constraint`);
      } else if (effectiveDateFilter) {
        console.log(`[chat-with-rag] Applying date filter: ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);
      }

      // Check if we have entries in the date range for temporal queries
      if (effectiveDateFilter && strictDateEnforcement) {
        console.log(`[chat-with-rag] Date filter detected, checking for entries in range: ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);
        
        const { count: entriesInRange } = await supabase
          .from('Journal Entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', effectiveDateFilter.startDate)
          .lte('created_at', effectiveDateFilter.endDate);

        console.log(`[chat-with-rag] Found ${entriesInRange || 0} entries in date range ${effectiveDateFilter.startDate} to ${effectiveDateFilter.endDate}`);

        if (!entriesInRange || entriesInRange === 0) {
          console.log(`[chat-with-rag] NO ENTRIES found in date range - returning empty result with strict date enforcement`);
          hasEntriesInDateRange = false;
          continue; // Skip this sub-question
        } else {
          console.log(`[chat-with-rag] Found ${entriesInRange} entries in date range, proceeding with search`);
        }
      }

      // Execute SQL queries if any
      if (sqlQueries.length > 0) {
        console.log(`[chat-with-rag] Executing ${sqlQueries.length} SQL queries for sub-question`);
        
        for (const sqlQuery of sqlQueries) {
          try {
            let queryResult = null;
            
            // CRITICAL: Apply time override to SQL parameters
            let sqlParams = { ...sqlQuery.parameters };
            
            if (useAllEntries && hasPersonalPronouns && !hasExplicitTimeReference) {
              // Override: Remove date constraints
              sqlParams.start_date = null;
              sqlParams.end_date = null;
              console.log(`[chat-with-rag] TIME OVERRIDE: Removing SQL date constraints for personal query`);
            } else if (effectiveDateFilter) {
              // Apply date constraints
              sqlParams.start_date = effectiveDateFilter.startDate;
              sqlParams.end_date = effectiveDateFilter.endDate;
            }
            
            if (sqlQuery.function === 'get_top_emotions_with_entries') {
              const { data, error } = await supabase.rpc(sqlQuery.function, {
                user_id_param: userId,
                start_date: sqlParams.start_date,
                end_date: sqlParams.end_date,
                limit_count: sqlParams.limit_count || 5
              });
              
              if (error) throw error;
              queryResult = data || [];
              
            } else if (sqlQuery.function === 'match_journal_entries_by_emotion') {
              const { data, error } = await supabase.rpc(sqlQuery.function, {
                emotion_name: sqlParams.emotion_name,
                user_id_filter: userId,
                min_score: sqlParams.min_score || 0.3,
                start_date: sqlParams.start_date,
                end_date: sqlParams.end_date,
                limit_count: sqlParams.limit_count || 5
              });
              
              if (error) throw error;
              queryResult = data || [];
            }
            
            console.log(`[chat-with-rag] SQL query ${sqlQuery.function} returned ${queryResult?.length || 0} results (date filtered: ${!!effectiveDateFilter})`);
            
            if (queryResult && queryResult.length > 0) {
              allResults.push(...queryResult.map(result => ({
                ...result,
                source: 'sql_query',
                query_function: sqlQuery.function
              })));
            } else if (strictDateEnforcement) {
              console.log(`[chat-with-rag] ENFORCING STRICT DATE CONSTRAINTS: No fallback applied due to date filter (results: ${queryResult?.length || 0})`);
            }
            
          } catch (error) {
            console.error(`[chat-with-rag] Error executing SQL query ${sqlQuery.function}:`, error);
          }
        }
      }

      // Execute vector search if enabled
      if (vectorSearch.enabled) {
        try {
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

          // Perform vector search with or without date filter
          let vectorResults = [];
          
          if (effectiveDateFilter) {
            const { data, error } = await supabase.rpc('match_journal_entries_with_date', {
              query_embedding: embedding,
              match_threshold: vectorSearch.threshold || 0.1,
              match_count: 10,
              user_id_filter: userId,
              start_date: effectiveDateFilter.startDate,
              end_date: effectiveDateFilter.endDate
            });
            
            if (error) throw error;
            vectorResults = data || [];
            
          } else {
            const { data, error } = await supabase.rpc('match_journal_entries_fixed', {
              query_embedding: embedding,
              match_threshold: vectorSearch.threshold || 0.1,
              match_count: useAllEntries ? 50 : 10, // More results for personal queries
              user_id_filter: userId
            });
            
            if (error) throw error;
            vectorResults = data || [];
          }

          console.log(`[chat-with-rag] Vector search returned ${vectorResults.length} results (threshold: ${vectorSearch.threshold}, dateFilter: ${!!effectiveDateFilter})`);

          if (vectorResults.length > 0) {
            allResults.push(...vectorResults.map(result => ({
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

    // Remove duplicates and limit results
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    ).slice(0, useAllEntries ? 100 : 15);

    console.log(`[chat-with-rag] Sub-question execution completed: ${uniqueResults.length} unique results from ${queryPlan.subQuestions?.length || 0} sub-questions (strict date enforcement: ${strictDateEnforcement}, no entries in range: ${!hasEntriesInDateRange})`);

    console.log(`[chat-with-rag] Retrieved ${uniqueResults.length} total relevant entries (strict date enforcement: ${strictDateEnforcement})`);

    // Handle case where no entries found due to strict date enforcement
    if (strictDateEnforcement && !hasEntriesInDateRange) {
      console.log(`[chat-with-rag] STRICT DATE ENFORCEMENT: No entries in specified date range - generating appropriate message`);
      
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

    if (uniqueResults.length === 0) {
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

    // Prepare context for GPT with enhanced personal context
    const journalContext = uniqueResults.map(entry => {
      const content = entry.content || entry.sample_entries?.[0]?.content || 'No content available';
      const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Unknown date';
      const emotions = entry.emotions ? Object.keys(entry.emotions).slice(0, 3).join(', ') : 'No emotions detected';
      
      return `Date: ${date}\nContent: ${content.substring(0, 300)}...\nEmotions: ${emotions}`;
    }).join('\n\n---\n\n');

    const systemPrompt = `You are SOULo, a compassionate AI assistant that helps users understand their journal entries and emotional patterns.

Context: The user has ${userEntryCount} total journal entries. ${useAllEntries ? 'You are analyzing ALL their entries for comprehensive personal insights.' : `You are analyzing ${uniqueResults.length} relevant entries.`}

${hasPersonalPronouns ? 'IMPORTANT: This is a personal question about the user themselves. Provide personalized insights and speak directly to them about their patterns, growth, and experiences.' : ''}

${hasExplicitTimeReference ? `IMPORTANT: This query is specifically about ${queryPlan.dateRange ? `the time period from ${new Date(queryPlan.dateRange.startDate).toLocaleDateString()} to ${new Date(queryPlan.dateRange.endDate).toLocaleDateString()}` : 'a specific time period'}. Focus your analysis on that timeframe.` : ''}

Based on these journal entries, provide a helpful, warm, and insightful response to: "${message}"

Journal Entries:
${journalContext}

Guidelines:
- Be warm, empathetic, and supportive
- Provide specific insights based on the actual journal content
- ${hasPersonalPronouns ? 'Use "you" and "your" to make it personal since they asked about themselves' : 'Keep the tone conversational but not overly personal'}
- If patterns emerge, point them out constructively
- ${useAllEntries ? 'Since you have access to their full journal history, provide comprehensive insights about long-term patterns' : 'Focus on the specific entries provided'}
- End with an encouraging note or helpful suggestion`;

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

      return new Response(JSON.stringify({
        response,
        hasData: true,
        entryCount: uniqueResults.length,
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
        hasData: uniqueResults.length > 0,
        entryCount: uniqueResults.length
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
