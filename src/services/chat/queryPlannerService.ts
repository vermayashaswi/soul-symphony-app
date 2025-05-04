
/**
 * Service for planning complex queries and synthesizing multiple sub-query responses
 */
import { supabase } from "@/integrations/supabase/client";
import { analyzeQueryTypes } from "@/utils/chat/queryAnalyzer";

interface ConversationMessage {
  role: string;
  content: string;
}

/**
 * Generates a plan for breaking down a complex query into sub-queries
 */
export async function planQueryExecution(
  query: string, 
  conversationContext: ConversationMessage[] = []
): Promise<string[]> {
  try {
    console.log("Planning query execution for:", query);
    
    // First analyze the query to extract time ranges, emotion focus, etc.
    const queryAnalysis = analyzeQueryTypes(query);
    
    // Add detailed time range information to planning context
    let timeContext = '';
    if (queryAnalysis.timeRange.startDate && queryAnalysis.timeRange.endDate) {
      const startDate = new Date(queryAnalysis.timeRange.startDate);
      const endDate = new Date(queryAnalysis.timeRange.endDate);
      timeContext = `User is asking about the time period: ${queryAnalysis.timeRange.periodName} (${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}).\n`;
    }
    
    // Get database schema information for context
    const tables = ['Journal Entries', 'chat_messages', 'chat_threads', 'emotions', 'journal_embeddings'];
    let dbSchemaContext = '';
    
    try {
      for (const table of tables) {
        const { data, error } = await supabase.rpc('check_table_columns', { table_name: table });
        if (error) {
          console.error(`Error getting schema for ${table}:`, error);
          continue;
        }
        
        dbSchemaContext += `Table: ${table}\nColumns: ${data.map(col => `${col.column_name} (${col.data_type})`).join(', ')}\n\n`;
      }
    } catch (schemaError) {
      console.error("Error fetching schema context:", schemaError);
      // Fallback to minimal schema info if error occurs
      dbSchemaContext = `Tables: Journal Entries (contains user's journal data), emotions (list of emotions), journal_embeddings (vector representations of entries)\n`;
    }
    
    // Get available functions for context
    const functionsContext = `
    Available database functions:
    - match_journal_entries_fixed: Vector similarity search on journal entries
    - match_journal_entries_with_date: Vector similarity search with date filtering
    - match_journal_entries_by_emotion: Find entries with specific emotions
    - match_journal_entries_by_theme: Find entries with specific themes
    - get_top_emotions: Get most frequent emotions in a time period
    - get_top_emotions_with_entries: Get top emotions with sample journal entries
    - execute_dynamic_query: Execute custom SQL queries with parameters
    
    You can use SQL queries or vector searches as needed. For SQL, you can construct queries using:
    SELECT * FROM "Journal Entries" WHERE user_id = '...' AND ...
    
    For vector searches, call the appropriate function and specify any time range, emotion, or theme filters.
    `;
    
    // Format conversation context for the prompt
    let conversationContextText = '';
    if (conversationContext && conversationContext.length > 0) {
      conversationContextText = "Recent conversation context:\n";
      conversationContext.forEach((msg, i) => {
        conversationContextText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 150)}${msg.content.length > 150 ? '...' : ''}\n`;
      });
      conversationContextText += "\nConsider this conversation history when planning your research approach.\n";
    }
    
    // Send to OpenAI for planning with expanded context
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a research planner for a voice journaling app. A user has asked a question related to their journal entries. Your job is to create a comprehensive research plan to answer their question.

Based on the user's question and conversation history, you should:

1. Decide if the question requires accessing and analyzing journal entries or if it's a general question.
2. If it requires journal access, create a research plan with specific steps to retrieve and analyze the relevant data.
3. Your research plan should specify:
   - What database functions or SQL queries to use
   - What parameters to include (time ranges, emotions, themes, etc.)
   - How to process and synthesize the information

You can use these approaches in your plan:
- Direct SQL queries when precise filtering is needed
- Vector similarity search for semantic matching
- Emotion-based filtering for questions about feelings
- Time-based filtering for questions about specific periods
- Topic/theme-based analysis for content questions

Database Schema:
${dbSchemaContext}

${functionsContext}

${conversationContextText}

Query Analysis:
${timeContext}
${queryAnalysis.isEmotionFocused ? 'This query is focused on emotions.\n' : ''}
${queryAnalysis.isTemporalQuery ? `This query has a temporal component focused on: ${queryAnalysis.timeRange.periodName}.\n` : ''}
${queryAnalysis.isWhyQuestion ? 'This is a "why" question that needs deeper context.\n' : ''}
${queryAnalysis.needsDataAggregation ? 'This query requires data aggregation across multiple entries.\n' : ''}
${queryAnalysis.theme ? `This query is asking about the theme: ${queryAnalysis.theme}.\n` : ''}

The user asked: "${query}"

Output your research plan in JSON format following this structure:
{
  "queryType": "journal_specific" or "general",
  "requiresDataRetrieval": true/false,
  "strategy": "sql_query" or "vector_search" or "hybrid",
  "steps": [
    {
      "type": "vector_search" or "sql_query",
      "description": "Description of what this step retrieves",
      "parameters": {
        // Parameters specific to this query type
      }
    }
  ],
  "aggregation": "Description of how to combine results if needed"
}`
            }
          ],
          temperature: 0.2
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Error in query planning:", error);
        return [query]; // Fall back to original query
      }

      const result = await response.json();
      const planText = result.choices[0]?.message?.content || '';
      
      try {
        // Parse the research plan JSON
        const researchPlan = JSON.parse(planText);
        console.log("Generated research plan:", researchPlan);
        
        // Convert the research plan into executable steps
        let steps = [];
        
        // If it's a general query, just return the original query
        if (researchPlan.queryType === "general") {
          return [query];
        }
        
        // For journal-specific queries, generate steps based on the research plan
        if (researchPlan.requiresDataRetrieval) {
          steps = researchPlan.steps.map(step => JSON.stringify(step));
          
          // If no steps were generated, fall back to the original query
          if (steps.length === 0) {
            return [query];
          }
        } else {
          // If no data retrieval is needed, just use the original query
          return [query];
        }
        
        // Add the original query as context for the later synthesis step
        steps.unshift(JSON.stringify({ 
          type: "original_query", 
          query,
          hasConversationContext: conversationContext && conversationContext.length > 0
        }));
        
        return steps;
      } catch (parseError) {
        console.error("Error parsing research plan:", parseError);
        return [query]; // Fall back to original query
      }
    } catch (planningError) {
      console.error("Error in planning stage:", planningError);
      
      // If the advanced planning fails, fall back to a simpler approach
      return [
        JSON.stringify({ type: "original_query", query }), 
        JSON.stringify({ 
          type: "vector_search", 
          description: "Default vector search for the query",
          parameters: {
            query,
            matchThreshold: 0.5,
            matchCount: 10
          }
        })
      ];
    }
  } catch (error) {
    console.error("Error planning query execution:", error);
    return [query]; // Fall back to original query
  }
}

/**
 * Executes a research step from the query plan
 */
export async function executeResearchStep(step: string, userId: string): Promise<any> {
  try {
    const stepData = JSON.parse(step);
    console.log("Executing research step:", stepData);
    
    // Handle the original query step (just pass it through)
    if (stepData.type === "original_query") {
      return { 
        type: "original_query",
        originalQuery: stepData.query,
        hasConversationContext: stepData.hasConversationContext || false
      };
    }
    
    // Handle vector search steps
    if (stepData.type === "vector_search") {
      const { timeRange, matchThreshold = 0.5, matchCount = 10, emotion, theme, query } = stepData.parameters || {};
      
      // Generate embedding for the query
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: query || stepData.description,
        }),
      });

      if (!embeddingResponse.ok) {
        const error = await embeddingResponse.text();
        throw new Error(`Failed to generate embedding: ${error}`);
      }

      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.data[0].embedding;
      
      // Determine which function to call based on parameters
      let result;
      
      if (emotion) {
        // Use emotion-based search
        const { data, error } = await supabase.rpc('match_journal_entries_by_emotion', {
          emotion_name: emotion,
          user_id_filter: userId,
          min_score: 0.3,
          start_date: timeRange?.startDate || null,
          end_date: timeRange?.endDate || null,
          limit_count: matchCount
        });
        
        if (error) throw error;
        result = data;
      } else if (theme) {
        // Use theme-based search
        const { data, error } = await supabase.rpc('match_journal_entries_by_theme', {
          theme_query: theme,
          user_id_filter: userId,
          match_threshold: matchThreshold,
          match_count: matchCount,
          start_date: timeRange?.startDate || null,
          end_date: timeRange?.endDate || null
        });
        
        if (error) throw error;
        result = data;
      } else if (timeRange?.startDate || timeRange?.endDate) {
        // Use time-filtered vector search
        const { data, error } = await supabase.rpc('match_journal_entries_with_date', {
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount,
          user_id_filter: userId,
          start_date: timeRange?.startDate || null,
          end_date: timeRange?.endDate || null
        });
        
        if (error) throw error;
        result = data;
      } else {
        // Use standard vector search
        const { data, error } = await supabase.rpc('match_journal_entries_fixed', {
          query_embedding: queryEmbedding,
          match_threshold: matchThreshold,
          match_count: matchCount,
          user_id_filter: userId
        });
        
        if (error) throw error;
        result = data;
      }
      
      return {
        type: "vector_search_results",
        description: stepData.description,
        entries: result
      };
    }
    
    // Handle SQL query steps
    if (stepData.type === "sql_query") {
      const { query, parameters = [] } = stepData.parameters || {};
      
      if (!query) throw new Error("SQL query not specified in step parameters");
      
      // Execute the SQL query
      const { data, error } = await supabase.rpc('execute_dynamic_query', {
        query_text: query,
        param_values: parameters
      });
      
      if (error) throw error;
      
      return {
        type: "sql_query_results",
        description: stepData.description,
        data
      };
    }
    
    throw new Error(`Unknown research step type: ${stepData.type}`);
  } catch (error) {
    console.error("Error executing research step:", error);
    throw error;
  }
}

/**
 * Synthesizes research results into a single coherent response
 */
export async function synthesizeResponses(
  originalQuery: string, 
  researchSteps: string[], 
  researchResults: any[],
  conversationContext: ConversationMessage[] = []
): Promise<string> {
  try {
    console.log("Synthesizing responses for query:", originalQuery);
    
    // Find the original query in the research results
    let originalQueryData = researchResults.find(result => result.type === "original_query");
    const hasConversationContext = originalQueryData?.hasConversationContext || false;
    originalQueryData = originalQueryData ? originalQueryData.originalQuery : originalQuery;
    
    // Analyze the original query to get time context
    const queryAnalysis = analyzeQueryTypes(originalQueryData);
    
    // Format time range for the prompt
    let timeContext = '';
    if (queryAnalysis.isTemporalQuery && queryAnalysis.timeRange.startDate && queryAnalysis.timeRange.endDate) {
      const startDate = new Date(queryAnalysis.timeRange.startDate);
      const endDate = new Date(queryAnalysis.timeRange.endDate);
      timeContext = `The user asked about the time period: ${queryAnalysis.timeRange.periodName} (${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}).\n`;
    }
    
    // Format the research results for the prompt
    const formattedResults = researchResults
      .filter(result => result.type && result.type !== "original_query") // Filter out the original query
      .map((result, index) => {
        let formattedResult = `Research Result ${index + 1}: ${result.description || result.type}\n`;
        
        if (result.type === "vector_search_results") {
          // Format journal entries
          formattedResult += "Journal Entries:\n";
          if (result.entries && result.entries.length > 0) {
            result.entries.forEach((entry, i) => {
              const date = new Date(entry.created_at).toLocaleDateString();
              formattedResult += `Entry ${i + 1} (${date}): ${entry.content.substring(0, 300)}${entry.content.length > 300 ? '...' : ''}\n`;
            });
          } else {
            formattedResult += "No entries found.\n";
          }
        } else if (result.type === "sql_query_results") {
          // Format SQL query results
          formattedResult += "SQL Query Results:\n";
          if (result.data && result.data.length > 0) {
            formattedResult += JSON.stringify(result.data, null, 2) + "\n";
          } else {
            formattedResult += "No results found.\n";
          }
        } else if (result.type === "fallback") {
          formattedResult += "This research step failed: " + (result.error || "Unknown error") + "\n";
        }
        
        return formattedResult;
      })
      .join("\n\n");
    
    // Format conversation history for context
    let conversationHistoryText = '';
    if (hasConversationContext && conversationContext.length > 0) {
      conversationHistoryText = "\n\nRecent conversation history:\n";
      conversationContext.slice(-5).forEach((msg, i) => {
        conversationHistoryText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.substring(0, 300)}${msg.content.length > 300 ? '...' : ''}\n\n`;
      });
    }
    
    // Send to OpenAI for synthesis with conversation context
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert journaling assistant helping users reflect on their emotional and mental well-being.

The user asked:
"${originalQuery}"

${timeContext ? `Time Context: ${timeContext}` : ''}
${conversationHistoryText}

We have analyzed this by conducting research on the user's journal entries, and here are the results:
${formattedResults}

Your task is to:
1. Synthesize all the research results into a single, clear, well-structured response
2. Fully address the user's original question, drawing insights from the research data
3. Combine both quantitative analysis (e.g., frequency, trends, scores) and qualitative interpretation
4. Be empathetic and supportive in tone
5. Use short paragraphs or bullet points to enhance readability
6. Present a meaningful takeaway or reflection for the user
7. Do not mention the research process, steps, or technical details
8. If the question asks about a specific time period but the results include entries from outside that period, clarify this to the user
9. If the response is part of an ongoing conversation, ensure continuity with previous responses

Be concise and insightful. Keep the tone conversational, supportive, and emotionally intelligent.`
          }
        ],
        temperature: 0.5
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error in response synthesis:", error);
      return "I'm having trouble synthesizing information from your journal. Could you try asking a more specific question?";
    }

    const result = await response.json();
    const synthesizedResponse = result.choices[0]?.message?.content || '';
    
    console.log("Generated synthesized response:", synthesizedResponse.substring(0, 100) + "...");
    
    return synthesizedResponse;
  } catch (error) {
    console.error("Error synthesizing responses:", error);
    return "I encountered an error while analyzing your journal entries. Please try again with a different question.";
  }
}
