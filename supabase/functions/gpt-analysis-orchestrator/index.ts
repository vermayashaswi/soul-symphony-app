import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subQuestions, userMessage, userId, timeRange, messageId } = await req.json();
    
    console.log('GPT Analysis Orchestrator called with:', { 
      subQuestionsCount: subQuestions?.length || 0,
      userMessage: userMessage?.substring(0, 100),
      userId,
      timeRange,
      messageId 
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Prepare sub-questions (fallback to original message if none provided)
    const effectiveSubQuestions = (Array.isArray(subQuestions) && subQuestions.length > 0)
      ? subQuestions
      : [{ question: userMessage, type: 'unknown', priority: 1 }];

    // Enhanced schema/context for GPT planning with full analytical capabilities
    const SCHEMA_CONTEXT = `
You operate over a single user-scoped table named "Journal Entries" with columns:
- id (bigint, primary key)
- user_id (uuid, required)
- created_at (timestamptz)
- "refined text" (text)
- "transcription text" (text)
- master_themes (text[]) -- array of theme strings like ["love", "work", "family"]
- themes (text[])
- entities (jsonb) -- object of arrays, e.g. { "person": ["alice"], "organization": ["acme"] }
- emotions (jsonb) -- object of numeric scores, e.g. { "happy": 0.72, "anxious": 0.12 }
- sentiment (text) -- 'positive' | 'neutral' | 'negative'
- duration (numeric) -- length in seconds if applicable
- entityemotion (jsonb) -- entity-emotion relationships with strength scores

ANALYTICAL CAPABILITIES:
You can generate complex SQL calculations including:
- Percentage calculations: COUNT(CASE WHEN condition THEN 1 END) * 100.0 / COUNT(*) as percentage
- Ratios and proportions between different groups
- Aggregations with CTEs and window functions
- Theme/emotion frequency analysis
- Temporal trends and comparisons

SAFETY CONSTRAINTS:
- All queries MUST include WHERE user_id = $user_id for data isolation
- Only SELECT operations allowed (no INSERT/UPDATE/DELETE)
- No system tables or functions access
- No nested function calls or complex permissions

Row Level Security ensures access is per user; you MUST include user filter in your plan.
`;

    // Ask GPT-4.1 to create a JSON execution plan for each sub-question
    const analysisPlans = await Promise.all(
      effectiveSubQuestions.map(async (subQuestion: any, index: number) => {
        const plannerPrompt = `
Return ONLY a strict JSON object describing how to answer this sub-question using SQL, vector search, or advanced SQL calculation.
Use the following output schema exactly:
{
  "query_type": "sql_count" | "sql_select" | "sql_calculation" | "vector_search" | "hybrid",
  "reasoning": "short rationale",
  "sql": {
    "operation": "count" | "select" | "calculation",
    "raw_query": "SELECT ... FROM \\"Journal Entries\\" WHERE user_id = $1 AND ...",
    "columns": ["id","created_at","master_themes","emotions"] | null,
    "filters": [
      // Supported ops: eq, eq_auth_uid, gte, lte, ilike, cs, json_key_gte
      { "column": "user_id", "op": "eq_auth_uid" },
      { "column": "created_at", "op": "gte", "value": "ISO-8601" },
      { "column": "created_at", "op": "lte", "value": "ISO-8601" },
      { "column": "master_themes", "op": "cs", "value": ["work"] },
      { "column": "emotions", "op": "json_key_gte", "key": "anxious", "value": 0.5 }
    ],
    "order_by": [{ "column": "created_at", "direction": "desc" }] | [],
    "limit": number | null
  } | null,
  "vector": {
    "enabled": boolean,
    "query_text": string,
    "top_k": number,
    "threshold": number,
    "use_date_filter": boolean,
    "date_range": { "start": "ISO-8601" | null, "end": "ISO-8601" | null } | null
  } | null
}
Rules:
- Use "sql_calculation" for percentage, ratio, and complex analytical queries
- For calculations, provide a complete SELECT statement in "raw_query" field
- Always use parameterized queries with $1 for user_id in raw_query
- Prefer sql_count for simple counts like "how many entries since ..."
- Always include a user filter via eq_auth_uid in SQL filters or WHERE user_id = $1 in raw_query
- If the text implies a date range (e.g., "since July", "last week"), include created_at filters
- Use vector_search only for semantic retrieval of example passages; never for simple counts
- If both are useful, choose "hybrid" and fill both sections
- Output must be valid JSON, no code fences

CALCULATION EXAMPLES:
- Percentage: "SELECT (COUNT(CASE WHEN 'love' = ANY(master_themes) THEN 1 END) * 100.0 / COUNT(*)) as percentage FROM \\"Journal Entries\\" WHERE user_id = $1"
- Theme distribution: "SELECT theme, COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage FROM (SELECT unnest(master_themes) as theme FROM \\"Journal Entries\\" WHERE user_id = $1) t GROUP BY theme"
- Emotion averages: "SELECT emotion_key, AVG((emotion_value)::numeric) as avg_score FROM \\"Journal Entries\\", jsonb_each(emotions) WHERE user_id = $1 GROUP BY emotion_key"

Context:
SCHEMA:\n${SCHEMA_CONTEXT}\n
Sub-question: "${subQuestion.question}"
Original user message (for context): "${userMessage}"
Incoming timeRange (may be null): ${timeRange ? JSON.stringify(timeRange) : 'null'}
        `;

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-2025-04-14',
              messages: [
                { role: 'system', content: 'You are a precise query planner. Respond only with valid JSON per the requested schema.' },
                { role: 'user', content: plannerPrompt }
              ],
              response_format: { type: 'json_object' },
              max_tokens: 700
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GPT Analysis Orchestrator] OpenAI planning error for sub-question ${index}:`, errorText);
            return {
              subQuestion,
              analysisPlan: {
                query_type: 'vector_search',
                reasoning: `Fallback due to OpenAI error: ${response.status}`,
                sql: null,
                vector: {
                  enabled: true,
                  query_text: subQuestion.question,
                  top_k: 10,
                  threshold: 0.3,
                  use_date_filter: Boolean(timeRange?.start || timeRange?.end),
                  date_range: timeRange || null
                }
              },
              index
            };
          }

          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content || '';

          let plan: any;
          try {
            plan = JSON.parse(content);
          } catch (e) {
            console.warn(`Failed to parse planner JSON for sub-question ${index}, content:`, content);
            plan = {
              query_type: 'vector_search',
              reasoning: 'Fallback due to parsing error',
              sql: null,
              vector: {
                enabled: true,
                query_text: subQuestion.question,
                top_k: 10,
                threshold: 0.3,
                use_date_filter: Boolean(timeRange?.start || timeRange?.end),
                date_range: timeRange || null
              }
            };
          }

          // If timeRange was provided by caller and plan lacks date filters, inject them
          if (timeRange && plan) {
            if (plan.sql && Array.isArray(plan.sql.filters)) {
              const hasGte = plan.sql.filters.some((f: any) => f.column === 'created_at' && f.op === 'gte');
              const hasLte = plan.sql.filters.some((f: any) => f.column === 'created_at' && f.op === 'lte');
              if (timeRange.start && !hasGte) plan.sql.filters.push({ column: 'created_at', op: 'gte', value: timeRange.start });
              if (timeRange.end && !hasLte) plan.sql.filters.push({ column: 'created_at', op: 'lte', value: timeRange.end });
            }
            if (plan.vector && plan.vector.enabled && plan.vector.use_date_filter && !plan.vector.date_range) {
              plan.vector.date_range = timeRange;
            }
          }

          return { subQuestion, analysisPlan: plan, index };
        } catch (error) {
          console.error(`Error planning analysis for sub-question ${index}:`, error);
          return {
            subQuestion,
            analysisPlan: {
              query_type: 'vector_search',
              reasoning: 'Fallback due to exception',
              sql: null,
              vector: {
                enabled: true,
                query_text: subQuestion.question,
                top_k: 10,
                threshold: 0.3,
                use_date_filter: Boolean(timeRange?.start || timeRange?.end),
                date_range: timeRange || null
              }
            },
            index
          };
        }
      })
    );


    // Execute the planned analyses (dynamic SQL via query builder + minimal vector RPCs)
    const analysisResults = await Promise.all(
      analysisPlans.map(async ({ subQuestion, analysisPlan, index }) => {
        const results: any = {
          subQuestion,
          analysisPlan,
          vectorResults: null,
          sqlResults: null,
          error: null
        };

        // Helpers to apply filters safely
        const applyFilters = (query: any, filters: any[] = []) => {
          for (const f of filters) {
            const op = f.op;
            const col = f.column;
            switch (op) {
              case 'eq_auth_uid':
                query = query.eq('user_id', userId);
                break;
              case 'eq':
                query = query.eq(col, f.value);
                break;
              case 'gte':
                query = query.gte(col, f.value);
                break;
              case 'lte':
                query = query.lte(col, f.value);
                break;
              case 'ilike':
                query = query.ilike(col, f.value);
                break;
              case 'cs': // contains
                query = query.contains(col, f.value);
                break;
              case 'json_key_gte':
                if (f.key) {
                  query = query.filter(`${col}->>${f.key}`, 'gte', String(f.value));
                }
                break;
              default:
                console.warn('Unsupported filter op:', f);
            }
          }
          return query;
        };

        try {
          // VECTOR EXECUTION
          const wantVector = analysisPlan?.query_type === 'vector_search' || analysisPlan?.query_type === 'hybrid';
          if (wantVector && analysisPlan?.vector?.enabled) {
            const v = analysisPlan.vector;
            const vectorQueryText = v.query_text || subQuestion.question;
            const embedResp = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: vectorQueryText,
              }),
            });
            const embedJson = await embedResp.json();
            const embedding = embedJson?.data?.[0]?.embedding;

            const dateRange = (v.use_date_filter && v.date_range) ? v.date_range : (timeRange || null);
            const useDate = Boolean(dateRange && (dateRange.start || dateRange.end));
            const rpcName = useDate ? 'match_journal_entries_with_date' : 'match_journal_entries';
            const rpcParams: any = {
              query_embedding: embedding,
              match_threshold: v.threshold ?? 0.3,
              match_count: v.top_k ?? 10,
              user_id_filter: userId
            };
            if (useDate) {
              rpcParams.start_date = dateRange.start || null;
              rpcParams.end_date = dateRange.end || null;
            }

            console.log(`[Vector Search] Calling ${rpcName} with params:`, { ...rpcParams, query_embedding: '[omitted]' });
            const { data: vectorResults, error: vectorError } = await createClient(supabaseUrl, supabaseServiceKey).rpc(rpcName, rpcParams);
            if (vectorError) {
              console.error('Vector search error:', vectorError);
            } else {
              results.vectorResults = vectorResults;
            }
          }

          // SQL EXECUTION
          const wantSql = analysisPlan?.query_type === 'sql_count' || analysisPlan?.query_type === 'sql_select' || analysisPlan?.query_type === 'sql_calculation' || analysisPlan?.query_type === 'hybrid';
          if (wantSql && analysisPlan?.sql) {
            const sqlPlan = analysisPlan.sql;
            const quoted = (c: string) => (c.includes(' ') ? `"${c}"` : c);

            if (sqlPlan.operation === 'calculation') {
              // Safe calculation path: derive counts via query builder and RPC, then compute percentage
              const filters = Array.isArray(sqlPlan.filters) ? [...sqlPlan.filters] : [];
              const gteIdx = filters.findIndex((f: any) => f.column === 'created_at' && f.op === 'gte');
              const lteIdx = filters.findIndex((f: any) => f.column === 'created_at' && f.op === 'lte');
              const rangeStart = (gteIdx >= 0 ? filters[gteIdx].value : (timeRange?.start || null));
              const rangeEnd = (lteIdx >= 0 ? filters[lteIdx].value : (timeRange?.end || null));
              // Ensure time range filters exist in filtered query
              if (rangeStart && gteIdx === -1) filters.push({ column: 'created_at', op: 'gte', value: rangeStart });
              if (rangeEnd && lteIdx === -1) filters.push({ column: 'created_at', op: 'lte', value: rangeEnd });

              // Subset count with filters
              let qCount = supabase
                .from('Journal Entries')
                .select('id', { count: 'exact', head: true });
              qCount = applyFilters(qCount, filters);
              qCount = qCount.eq('user_id', userId);
              const { count: filteredCount, error: filteredError } = await qCount;
              if (filteredError) {
                console.error('SQL calculation subset count error:', filteredError);
                results.error = `SQL calculation subset count error: ${filteredError.message}`;
              } else {
                // Total count in same range
                const { data: total, error: totalError } = await supabase.rpc('get_journal_entry_count', {
                  user_id_filter: userId,
                  start_date: rangeStart || null,
                  end_date: rangeEnd || null
                });
                if (totalError) {
                  console.error('SQL calculation total count error:', totalError);
                  results.error = `SQL calculation total count error: ${totalError.message}`;
                } else {
                  const totalNum = (total as number) ?? 0;
                  const subset = filteredCount ?? 0;
                  const percentage = totalNum > 0 ? Math.round((subset * 10000) / totalNum) / 100 : 0;
                  results.sqlResults = { filteredCount: subset, totalCount: totalNum, percentage };
                  console.log(`[SQL Calculation] subset/total/percentage:`, subset, totalNum, percentage);
                }
              }
            } else if (sqlPlan.operation === 'count') {
              // Use the new dedicated count RPC for reliable counting
              const startDate = sqlPlan.filters?.find(f => f.column === 'created_at' && f.op === 'gte')?.value || null;
              const endDate = sqlPlan.filters?.find(f => f.column === 'created_at' && f.op === 'lte')?.value || null;
              
              console.log(`[SQL Count] Using get_journal_entry_count with dates: ${startDate} to ${endDate}`);
              const { data: count, error } = await supabase.rpc('get_journal_entry_count', {
                user_id_filter: userId,
                start_date: startDate,
                end_date: endDate
              });
              
              if (error) {
                console.error('SQL count error:', error);
                results.error = `SQL count error: ${error.message}`;
              } else {
                results.sqlResults = { count: count ?? 0 };
                console.log(`[SQL Count] Result: ${count} entries`);
              }
            } else if (sqlPlan.operation === 'select') {
              const cols = (sqlPlan.columns && sqlPlan.columns.length)
                ? sqlPlan.columns.map(quoted).join(',')
                : 'id,created_at,master_themes,emotions';

              let q = createClient(supabaseUrl, supabaseServiceKey)
                .from('Journal Entries')
                .select(cols);

              q = applyFilters(q, sqlPlan.filters || []);
              // Ensure user scoping even if GPT forgot eq_auth_uid
              q = q.eq('user_id', userId);

              if (Array.isArray(sqlPlan.order_by)) {
                for (const ob of sqlPlan.order_by) {
                  q = q.order(ob.column, { ascending: (ob.direction || 'asc').toLowerCase() === 'asc' });
                }
              }

              if (sqlPlan.limit) q = q.limit(sqlPlan.limit);

              const { data, error } = await q;
              if (error) {
                console.error('SQL select error:', error);
                results.error = `SQL select error: ${error.message}`;
              } else {
                results.sqlResults = data || [];
              }
            }
          }
        } catch (error) {
          console.error(`Error executing analysis for sub-question ${index}:`, error);
          results.error = (error as Error).message;
        }

        return results;
      })
    );

    return new Response(JSON.stringify({
      success: true,
      analysisResults,
      summary: {
        totalSubQuestions: (Array.isArray(effectiveSubQuestions) ? effectiveSubQuestions.length : 0),
        completedAnalyses: analysisResults.length,
        strategies: analysisResults.map((r: any) => r.analysisPlan?.query_type)
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });


  } catch (error) {
    console.error('Error in GPT Analysis Orchestrator:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});