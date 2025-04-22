
/**
 * Service for planning complex queries and synthesizing multiple sub-query responses
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a plan for breaking down a complex query into sub-queries
 */
export async function planQueryExecution(query: string): Promise<string[]> {
  try {
    console.log("Planning query execution for:", query);
    
    // Get database schema information for context
    const tables = ['Journal Entries', 'chat_messages', 'chat_threads', 'emotions', 'journal_embeddings'];
    let dbSchemaContext = '';
    
    for (const table of tables) {
      const { data, error } = await supabase.rpc('check_table_columns', { table_name: table });
      if (error) {
        console.error(`Error getting schema for ${table}:`, error);
        continue;
      }
      
      dbSchemaContext += `Table: ${table}\nColumns: ${data.map(col => `${col.column_name} (${col.data_type})`).join(', ')}\n\n`;
    }
    
    // Get available functions for context
    const functionsContext = `
    Available functions:
    - match_journal_entries_fixed: Vector similarity search on journal entries
    - match_journal_entries_with_date: Vector similarity search with date filtering
    - match_journal_entries_by_emotion: Find entries with specific emotions
    - match_journal_entries_by_theme: Find entries with specific themes
    - get_top_emotions: Get most frequent emotions in a time period
    - get_top_emotions_with_entries: Get top emotions with sample journal entries
    `;
    
    // Send to OpenAI for planning
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
            content: `You are a task planning assistant in a voice journaling app. A user has asked a question related to their journal entries. Your job is to break this question into smaller, logical analysis steps or sub-queries (limit the sub-queries to a maximum of 3), if required, or feel free to return original query as is if it can be answered without this complex breakdown of original query.

Each step/sub-query should:
- Be specific and focused on a single aspect of the analysis
- Map to an available backend function (like emotion tracking, sentiment analysis, theme detection, etc.)
- Include the parameters required to execute that function
- Use available metadata such as dates, goal tags, or emotions if mentioned
- Aim to generate both qualitative and quantitative insights for synthesis

Your response should be a list of clearly named steps that a downstream orchestrator can use to call analysis functions and finally synthesize a response for the user.

Important rules:
- Don't generate results, only generate the analysis plan
- Do not reference journal entries directly
- Skip the plan if the user question is unrelated to journaling
- Output ONLY the queries, one per line, with no extra text or explanation

Database Schema:
${dbSchemaContext}

${functionsContext}

The user asked: "${query}"

Now generate a breakdown of steps using the available tools, database schema and column fields.`
          }
        ],
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error in query planning:", error);
      return [query]; // Fall back to original query
    }

    const result = await response.json();
    const planText = result.choices[0]?.message?.content || '';
    
    // Parse the response into individual sub-queries
    const subQueries = planText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log("Generated sub-queries:", subQueries);
    
    // If no sub-queries or just one, use the original query
    if (subQueries.length <= 1) {
      return [query];
    }
    
    // Limit to max 3 sub-queries
    return subQueries.slice(0, 3);
  } catch (error) {
    console.error("Error planning query execution:", error);
    return [query]; // Fall back to original query
  }
}

/**
 * Synthesizes multiple sub-query responses into a single coherent response
 */
export async function synthesizeResponses(
  originalQuery: string, 
  subQueries: string[], 
  subQueryResponses: { query: string, response: string }[]
): Promise<string> {
  try {
    console.log("Synthesizing responses for query:", originalQuery);
    
    // Format the sub-query outputs for the prompt
    const subQueryOutputsText = subQueryResponses.map((sqr, index) => {
      return `Sub-query ${index + 1}: "${sqr.query}"\nResults: ${sqr.response}\n`;
    }).join('\n');
    
    // Send to OpenAI for synthesis
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

We have analyzed this using multiple sub-queries, and here are their results:
${subQueryOutputsText}

Your task is to:
1. Synthesize the information from all sub-query outputs into a single, clear, well-structured response
2. Fully address the user's original question, referencing patterns, trends, or insights as needed
3. Combine both **quantitative analysis** (e.g., frequency, trends, scores) and **qualitative interpretation** (e.g., what this means emotionally or behaviorally)
4. Be empathetic and supportive in tone
5. Use short paragraphs or bullet points if needed to enhance readability
6. Avoid repeating content or listing all journal entries unless explicitly asked
7. Present a meaningful takeaway or reflection for the user
8. Do not mention sub-queries or technical function names

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

