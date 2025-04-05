
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define relevant database schema for GPT with detailed information
const DATABASE_SCHEMA = `
Table: "Journal Entries"
- id: bigint (primary key)
- user_id: uuid (references user, stored as text)
- created_at: timestamp with time zone
- "refined text": text (contains the cleaned journal content)
- transcription_text: text (raw transcription)
- master_themes: text[] (array of themes extracted from the journal)
- emotions: jsonb (emotion analysis with scores as key-value pairs, e.g. {"happy": 0.8, "sad": 0.2, "angry": 0.1, "excited": 0.6})
- sentiment: text (overall sentiment classification, e.g. "positive", "negative", "neutral")
- entities: jsonb (array of entities detected in the text, e.g. [{"type": "organization", "name": "Acme Inc"}])

Table: journal_embeddings
- id: bigint (primary key)
- journal_entry_id: bigint (references "Journal Entries".id)
- content: text (the text that was embedded)
- embedding: vector(1536) (the embedding vector)
- created_at: timestamp with time zone

Available SQL Functions:
1. execute_dynamic_query(query_text text, param_values text[] DEFAULT '{}'::text[]) - Executes a dynamic SQL query with parameter binding
2. match_journal_entries(query_embedding vector, match_threshold float, match_count int, user_id_filter uuid) - Finds journal entries by vector similarity
3. match_journal_entries_with_date(query_embedding vector, match_threshold float, match_count int, user_id_filter uuid, start_date timestamp, end_date timestamp) - Finds journal entries by vector similarity with date range filter
4. match_journal_entries_by_emotion(emotion_name text, user_id_filter uuid, min_score float, start_date timestamp, end_date timestamp, limit_count int) - Finds journal entries by specific emotion with minimum score

# Emotion classification reference:
- Positive emotions include: happy, joy, excited, content, grateful, peaceful, hopeful, satisfied, optimistic, proud, amused, inspired, loved
- Negative emotions include: sad, angry, anxious, disappointed, frustrated, fearful, stressed, worried, guilty, lonely, bored, jealous, ashamed
- Neutral emotions include: calm, curious, surprised, nostalgic, reflective, focused

Common Emotion Analysis SQL Patterns:

1. Finding top emotions across all entries:
   SELECT emotion_key, AVG(CAST(emotion_value AS FLOAT)) as avg_score
   FROM "Journal Entries",
        jsonb_each_text(emotions) as e(emotion_key, emotion_value)
   WHERE user_id = $1
   GROUP BY emotion_key
   ORDER BY avg_score DESC
   LIMIT 3;

2. Finding top positive emotions:
   WITH emotion_categories AS (
     SELECT emotion_key, AVG(CAST(emotion_value AS FLOAT)) as avg_score
     FROM "Journal Entries",
          jsonb_each_text(emotions) as e(emotion_key, emotion_value)
     WHERE user_id = $1
       AND emotion_key IN ('happy', 'joy', 'excited', 'content', 'grateful', 'peaceful', 'hopeful')
       AND created_at >= date_trunc('month', CURRENT_DATE)
     GROUP BY emotion_key
   )
   SELECT emotion_key, avg_score
   FROM emotion_categories
   ORDER BY avg_score DESC
   LIMIT 3;

3. Finding when a specific emotion was strongest:
   SELECT id, created_at, CAST(emotions->>'sad' AS FLOAT) as emotion_score, "refined text"
   FROM "Journal Entries"
   WHERE user_id = $1 AND emotions->>'sad' IS NOT NULL
   ORDER BY emotion_score DESC
   LIMIT 1;

4. Comparing positive vs negative emotions:
   WITH emotion_categories AS (
     SELECT 
       id, 
       created_at,
       COALESCE(emotions->>'happy', '0')::float + COALESCE(emotions->>'excited', '0')::float + COALESCE(emotions->>'content', '0')::float AS positive_score,
       COALESCE(emotions->>'sad', '0')::float + COALESCE(emotions->>'angry', '0')::float + COALESCE(emotions->>'anxious', '0')::float AS negative_score
     FROM "Journal Entries"
     WHERE user_id = $1
   )
   SELECT id, created_at, positive_score, negative_score, 
     CASE WHEN positive_score > negative_score THEN 'positive' ELSE 'negative' END as dominant_type,
     (positive_score - negative_score) as emotional_balance
   FROM emotion_categories
   ORDER BY created_at DESC;

5. Finding emotional trends over time:
   SELECT 
     DATE_TRUNC('week', created_at) as time_period,
     AVG(CAST(emotions->>'happy' AS FLOAT)) as avg_happiness,
     AVG(CAST(emotions->>'sad' AS FLOAT)) as avg_sadness
   FROM "Journal Entries"
   WHERE user_id = $1 AND emotions IS NOT NULL
   GROUP BY time_period
   ORDER BY time_period;
`;

// Generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  try {
    console.log("Generating embedding for query:", text.substring(0, 50) + "...");
    
    if (!openAIApiKey) {
      console.error("OpenAI API key is not set");
      throw new Error('OpenAI API key is not configured');
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error generating embedding:', errorText);
      throw new Error(`Failed to generate embedding: ${errorText}`);
    }

    const result = await response.json();
    if (!result.data || !result.data[0] || !result.data[0].embedding) {
      console.error('Unexpected embedding response structure:', result);
      throw new Error('Invalid embedding response structure');
    }
    
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error in generateEmbedding:', error);
    throw error;
  }
}

// Enhanced function to ask GPT to analyze the query and generate SQL
async function analyzeQueryWithGPT(
  userQuery: string, 
  userId: string,
  queryTypes: Record<string, boolean> = {}
) {
  try {
    console.log("Asking GPT to analyze query and generate SQL with query types:", queryTypes);
    
    let systemPrompt = `You are an AI assistant specialized in analyzing user queries about journal entries and generating appropriate SQL queries.

${DATABASE_SCHEMA}

Your task:
1. Analyze the user's question about their journal entries
2. Determine the best approach to answer their question based on its nature:
   a) For quantitative questions (statistics, counts, rankings, etc.), generate precise SQL queries
   b) For semantic/content questions, use vector similarity search
   c) For questions requiring both numerical data and context, use a hybrid approach

3. Generate a PostgreSQL query that:
   - Is accurate for the specific question type (aggregate functions for statistics, etc.)
   - Filters by the correct user_id
   - Uses appropriate GROUP BY, ORDER BY, and LIMIT clauses as needed
   - Is secure and properly parameterized
   - Returns only the necessary columns
   - For emotional analysis, properly extracts and analyzes the emotions jsonb field
   - For temporal questions, uses appropriate date functions
   - Uses jsonb_each_text() to extract emotion key-value pairs when needing to work with all emotions

4. Be especially attentive to:
   - Comparative questions asking for "most", "least", "top", etc.
   - Temporal questions asking "when" with emotional context
   - Questions about trends or patterns over time
   - Questions requiring counting, averaging, or analyzing distributions
   - Questions about "positive" or "negative" emotions (refer to the emotion classification)

For the emotions jsonb field, consider:
- It contains key-value pairs where keys are emotion names like "happy", "sad", "angry", "anxious", "excited"
- Values are floating point numbers between 0 and 1 representing the intensity of the emotion
- Not all entries will have all emotions, so handle NULLs appropriately`;

    // Add specific guidance based on query types
    if (queryTypes.isQuantitative || queryTypes.isComparative || queryTypes.asksForNumber) {
      systemPrompt += `\n\nSPECIAL INSTRUCTIONS FOR QUANTITATIVE/COMPARATIVE QUERIES:
- Use appropriate SQL aggregation functions (AVG, COUNT, SUM, etc.)
- For emotion-related queries:
  - Extract values using jsonb_each_text(emotions) as e(emotion_key, emotion_value)
  - For specific emotions, use emotions->>'emotion_name' with CAST() to convert to float
  - For comparisons across emotions, use jsonb_each_text to get all emotion key/value pairs
- For ranking questions (top N, etc.), use ORDER BY with LIMIT
- For "most" or "least" questions, use MAX/MIN or ORDER BY with LIMIT
- Calculate percentages when appropriate using CAST() to ensure proper numeric division
- Handle NULL values properly in calculations using COALESCE()
- For time-based analysis, use date_trunc and other time functions as needed
- If comparing positive vs negative emotions, group them appropriately based on the emotion classification reference`;
    }

    if (queryTypes.isTemporal) {
      systemPrompt += `\n\nSPECIAL INSTRUCTIONS FOR TEMPORAL QUERIES:
- For "when" questions, focus on extracting and formatting dates appropriately
- Use date_trunc to aggregate data by relevant time periods (day, week, month, etc.)
- Consider returning the actual dates of peak emotions or events
- For questions about trends over time, generate SQL that groups by time periods
- Use EXTRACT() functions to get specific components of dates when needed
- For questions about "most sad and why", include content from the journal to explain why
- For date ranges like "last month", use date_trunc('month', current_date - interval '1 month')
- For "last week", use date_trunc('week', current_date - interval '1 week')
- For "last year", use date_trunc('year', current_date - interval '1 year')`;
    }

    if (queryTypes.isEmotionFocused) {
      systemPrompt += `\n\nSPECIAL INSTRUCTIONS FOR EMOTION-FOCUSED QUERIES:
- Use jsonb_object_keys(emotions) to extract all emotion keys when needed
- For specific emotions, access their values using emotions->>'emotion_name' with CAST() to convert to float
- Consider the relative intensities of emotions (higher scores = stronger emotions)
- For complex emotion analysis, you may need to cross-reference with the text content
- Use conditional logic to categorize emotions as needed (e.g., CASE WHEN)
- For "positive" vs "negative" emotions, group them based on the emotion classification reference
- Positive emotions: happy, joy, excited, content, grateful, peaceful, hopeful, satisfied, optimistic, proud, amused, inspired, loved
- Negative emotions: sad, angry, anxious, disappointed, frustrated, fearful, stressed, worried, guilty, lonely, bored, jealous, ashamed
- Neutral emotions: calm, curious, surprised, nostalgic, reflective, focused`;
    }

    systemPrompt += `\n\nReturn your response in the following JSON format:
{
  "analysis": "Brief explanation of how you're approaching this query",
  "queryType": "quantitative", "semantic", "hybrid", or "informational",
  "requiresSql": true/false,
  "sqlQuery": "The SQL query to execute (if applicable)",
  "requiresVectorSearch": true/false,
  "vectorSearchText": "The text to use for vector search (if applicable)",
  "explanation": "Explanation of your reasoning"
}

Important: For the SQL query, the user_id parameter will be passed separately, so use $1 as a parameter placeholder for the user_id in the SQL query.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from GPT API:', errorText);
      throw new Error(`Failed to get response from GPT: ${errorText}`);
    }

    const result = await response.json();
    const analysisText = result.choices[0].message.content;
    
    try {
      const analysisJson = JSON.parse(analysisText);
      return analysisJson;
    } catch (parseError) {
      console.error("Failed to parse GPT response as JSON:", parseError);
      console.log("Raw response:", analysisText);
      throw new Error('Invalid JSON response from GPT');
    }
  } catch (error) {
    console.error("Error in analyzeQueryWithGPT:", error);
    throw error;
  }
}

// Function to execute SQL query generated by GPT
async function executeSqlQuery(sqlQuery: string, userId: string) {
  try {
    console.log("Executing SQL query:", sqlQuery);
    
    // Execute the SQL query with the userId as a parameter
    const { data, error, count } = await supabase.rpc('execute_dynamic_query', {
      query_text: sqlQuery,
      param_values: [userId]
    });
    
    if (error) {
      console.error("Error executing SQL query:", error);
      
      // Fallback: If the RPC method doesn't exist, try a direct query
      // Note: This is less secure and should be replaced with proper RPC
      console.log("Attempting direct query as fallback");
      
      const fallbackQuery = sqlQuery.replace('$1', `'${userId}'`);
      const { data: fallbackData, error: fallbackError } = await supabase.query(fallbackQuery);
      
      if (fallbackError) {
        console.error("Error in fallback query:", fallbackError);
        throw fallbackError;
      }
      
      return { data: fallbackData, count: fallbackData?.length || 0 };
    }
    
    return { data, count };
  } catch (error) {
    console.error("Error in executeSqlQuery:", error);
    throw error;
  }
}

// Function to perform vector similarity search
async function performVectorSearch(
  queryEmbedding: any,
  userId: string,
  sqlFilteredIds: number[] | null = null,
  matchThreshold: number = 0.5,
  matchCount: number = 5
) {
  try {
    console.log("Performing vector similarity search");
    
    let params: any = {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
      user_id_filter: userId
    };
    
    let functionName = 'match_journal_entries_with_date';
    
    // If we have SQL filtered IDs, we need to further filter the vector search
    if (sqlFilteredIds && sqlFilteredIds.length > 0) {
      console.log(`Restricting vector search to ${sqlFilteredIds.length} pre-filtered entries`);
      
      // This would require a custom function that accepts an array of IDs
      // For now, we'll implement a client-side filter
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        console.error("Error in vector similarity search:", error);
        throw error;
      }
      
      // Filter the results client-side to only include the pre-filtered IDs
      const filteredResults = data?.filter(item => 
        sqlFilteredIds.includes(Number(item.id))
      ) || [];
      
      console.log(`Vector search returned ${filteredResults.length} results after filtering`);
      return filteredResults;
    } else {
      // Standard vector search without pre-filtering
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        console.error("Error in vector similarity search:", error);
        throw error;
      }
      
      console.log(`Vector search returned ${data?.length || 0} results`);
      return data || [];
    }
  } catch (error) {
    console.error("Error in performVectorSearch:", error);
    throw error;
  }
}

// Enhanced function to calculate emotion statistics with more detailed analysis
async function calculateEmotionStatistics(userId: string, timeframe: string | null = null) {
  try {
    console.log("Calculating enhanced emotion statistics with timeframe:", timeframe);
    
    // Prepare date filters based on timeframe
    let startDate = null;
    let endDate = new Date();
    let timeframeClause = '';
    
    if (timeframe) {
      if (timeframe === 'day' || timeframe === 'today') {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'yesterday') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}' AND created_at <= '${endDate.toISOString()}'`;
      } else if (timeframe === 'week') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'month') {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'year') {
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      }
    }
    
    // Query to get all journal entries with emotions
    const query = `
      SELECT 
        id, 
        emotions, 
        created_at, 
        sentiment, 
        "refined text" 
      FROM "Journal Entries"
      WHERE user_id = $1
        ${timeframeClause}
      ORDER BY created_at DESC
    `;
    
    const { data: entries, error } = await supabase.rpc(
      'execute_dynamic_query',
      { query_text: query, param_values: [userId] }
    );
      
    if (error) {
      console.error("Error fetching entries:", error);
      throw error;
    }
    
    if (!entries || entries.length === 0) {
      return { success: false, message: "No journal entries with emotion data found" };
    }
    
    // Process the emotion data
    const emotionStats: Record<string, { 
      total: number, 
      count: number, 
      max: number, 
      min: number,
      scores: number[],
      entries: Array<{id: number, date: string, score: number, text: string}>
    }> = {};
    
    const entriesWithEmotions = entries.filter(entry => entry.emotions && Object.keys(entry.emotions).length > 0);
    
    if (entriesWithEmotions.length === 0) {
      return { success: false, message: "No emotions data found in journal entries" };
    }
    
    // Define positive and negative emotions for better analysis
    const positiveEmotions = ['happy', 'joy', 'excited', 'content', 'grateful', 'peaceful', 'hopeful', 'satisfied', 'optimistic', 'proud', 'amused', 'inspired', 'loved'];
    const negativeEmotions = ['sad', 'angry', 'anxious', 'disappointed', 'frustrated', 'fearful', 'stressed', 'worried', 'guilty', 'lonely', 'bored', 'jealous', 'ashamed'];
    
    // Collect statistics for each emotion
    entriesWithEmotions.forEach((entry, idx) => {
      const emotions = entry.emotions;
      if (!emotions) return;
      
      Object.entries(emotions).forEach(([emotion, score]) => {
        if (!emotionStats[emotion]) {
          emotionStats[emotion] = { 
            total: 0, 
            count: 0, 
            max: 0, 
            min: Number.MAX_VALUE,
            scores: [],
            entries: []
          };
        }
        
        const numericScore = typeof score === 'string' ? parseFloat(score) : (score as number);
        emotionStats[emotion].total += numericScore;
        emotionStats[emotion].count += 1;
        emotionStats[emotion].max = Math.max(emotionStats[emotion].max, numericScore);
        emotionStats[emotion].min = Math.min(emotionStats[emotion].min, numericScore);
        emotionStats[emotion].scores.push(numericScore);
        
        // Store entries with highest emotion scores for context retrieval
        emotionStats[emotion].entries.push({
          id: entry.id, 
          date: entry.created_at,
          score: numericScore,
          text: entry["refined text"] || ""
        });
      });
    });
    
    // Sort each emotion's entries by score (descending)
    Object.keys(emotionStats).forEach(emotion => {
      emotionStats[emotion].entries.sort((a, b) => b.score - a.score);
      // Limit to top 5 entries per emotion
      emotionStats[emotion].entries = emotionStats[emotion].entries.slice(0, 5);
    });
    
    // Calculate averages and normalize to 1-10 scale
    const emotionAverages: Record<string, { 
      average: number, 
      normalizedScore: number, 
      frequency: number,
      isPositive: boolean,
      isNegative: boolean,
      topEntries: Array<{date: string, score: number, text: string}>
    }> = {};
    
    const totalEntries = entriesWithEmotions.length;
    
    Object.entries(emotionStats).forEach(([emotion, stats]) => {
      const average = stats.total / stats.count;
      // Normalize to 1-10 scale (assuming original scores are 0-1)
      const normalizedScore = Math.round((average * 9) + 1);
      const frequency = (stats.count / totalEntries) * 100;
      
      emotionAverages[emotion] = {
        average, 
        normalizedScore,
        frequency,
        isPositive: positiveEmotions.includes(emotion.toLowerCase()),
        isNegative: negativeEmotions.includes(emotion.toLowerCase()),
        topEntries: stats.entries.map(entry => ({
          date: entry.date,
          score: entry.score,
          text: entry.text.substring(0, 150) + (entry.text.length > 150 ? "..." : "")
        }))
      };
    });
    
    // Calculate overall metrics
    let dominantEmotion = '';
    let highestAverage = 0;
    
    Object.entries(emotionAverages).forEach(([emotion, data]) => {
      if (data.average > highestAverage) {
        highestAverage = data.average;
        dominantEmotion = emotion;
      }
    });
    
    // Group emotions into positive and negative categories
    const emotionCategories = {
      positive: Object.entries(emotionAverages)
        .filter(([emotion]) => positiveEmotions.includes(emotion.toLowerCase()))
        .sort(([, a], [, b]) => b.normalizedScore - a.normalizedScore)
        .map(([emotion, data]) => ({ 
          name: emotion, 
          score: data.normalizedScore,
          frequency: Math.round(data.frequency)
        })),
      negative: Object.entries(emotionAverages)
        .filter(([emotion]) => negativeEmotions.includes(emotion.toLowerCase()))
        .sort(([, a], [, b]) => b.normalizedScore - a.normalizedScore)
        .map(([emotion, data]) => ({ 
          name: emotion, 
          score: data.normalizedScore,
          frequency: Math.round(data.frequency)
        }))
    };
    
    return {
      success: true,
      totalJournalEntries: entries.length,
      entriesWithEmotions: entriesWithEmotions.length,
      emotionScores: emotionAverages,
      topEmotions: Object.entries(emotionAverages)
        .sort(([, a], [, b]) => b.normalizedScore - a.normalizedScore)
        .slice(0, 5)
        .map(([emotion, data]) => ({ 
          name: emotion, 
          score: data.normalizedScore,
          frequency: Math.round(data.frequency),
          isPositive: data.isPositive,
          isNegative: data.isNegative
        })),
      bottomEmotions: Object.entries(emotionAverages)
        .sort(([, a], [, b]) => a.normalizedScore - b.normalizedScore)
        .slice(0, 5)
        .map(([emotion, data]) => ({ 
          name: emotion, 
          score: data.normalizedScore,
          frequency: Math.round(data.frequency),
          isPositive: data.isPositive,
          isNegative: data.isNegative
        })),
      emotionCategories,
      dominantEmotion,
      dominantEmotionScore: emotionAverages[dominantEmotion]?.normalizedScore || 0,
      timeframe: {
        oldest: entries.length > 0 ? entries[entries.length - 1].created_at : null,
        newest: entries.length > 0 ? entries[0].created_at : null,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate.toISOString()
      }
    };
  } catch (error) {
    console.error("Error calculating emotion statistics:", error);
    throw error;
  }
}

// Function to find emotional peaks and when they occurred
async function findEmotionalPeaks(userId: string, emotion: string, limit: number = 3, timeframe: string | null = null) {
  try {
    console.log(`Finding peaks for emotion: ${emotion} with timeframe: ${timeframe}`);
    
    // Prepare date filters based on timeframe
    let startDate = null;
    let endDate = new Date();
    let timeframeClause = '';
    
    if (timeframe) {
      if (timeframe === 'day' || timeframe === 'today') {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'yesterday') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}' AND created_at <= '${endDate.toISOString()}'`;
      } else if (timeframe === 'week') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'month') {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'year') {
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      }
    }
    
    // Find entries with the highest score for the specified emotion
    const query = `
      SELECT 
        id, 
        created_at, 
        emotions, 
        "refined text"
      FROM "Journal Entries"
      WHERE user_id = $1
        AND emotions ? '${emotion}'
        ${timeframeClause}
      ORDER BY CAST(emotions->>'${emotion}' AS FLOAT) DESC
      LIMIT ${limit}
    `;
    
    const { data, error } = await supabase.rpc(
      'execute_dynamic_query',
      { query_text: query, param_values: [userId] }
    );
    
    if (error) {
      console.error("Error fetching emotion peaks:", error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      return { success: false, message: `No journal entries found with emotion: ${emotion}` };
    }
    
    // Format the entries
    const formattedEntries = data.map(entry => ({
      id: entry.id,
      date: entry.created_at,
      score: typeof entry.emotions[emotion] === 'string' 
        ? parseFloat(entry.emotions[emotion]) 
        : entry.emotions[emotion],
      text: entry["refined text"] || ""
    }));
    
    return {
      success: true,
      emotion,
      peaks: formattedEntries.map(entry => ({
        date: entry.date,
        score: Math.round(entry.score * 100) / 100,
        text: entry.text.substring(0, 200) + (entry.text.length > 200 ? "..." : "")
      })),
      timeframe: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate.toISOString()
      }
    };
  } catch (error) {
    console.error("Error in findEmotionalPeaks:", error);
    throw error;
  }
}

// Function to get top N emotions by category (positive or negative)
async function getTopEmotionsByCategory(userId: string, category: 'positive' | 'negative', limit: number = 3, timeframe: string | null = null) {
  try {
    console.log(`Getting top ${limit} ${category} emotions with timeframe: ${timeframe}`);
    
    // Define positive and negative emotions
    const positiveEmotions = ['happy', 'joy', 'excited', 'content', 'grateful', 'peaceful', 'hopeful', 'satisfied', 'optimistic', 'proud', 'amused', 'inspired', 'loved'];
    const negativeEmotions = ['sad', 'angry', 'anxious', 'disappointed', 'frustrated', 'fearful', 'stressed', 'worried', 'guilty', 'lonely', 'bored', 'jealous', 'ashamed'];
    
    const emotionsToSearch = category === 'positive' ? positiveEmotions : negativeEmotions;
    
    // Prepare date filters based on timeframe
    let startDate = null;
    let endDate = new Date();
    let timeframeClause = '';
    
    if (timeframe) {
      if (timeframe === 'day' || timeframe === 'today') {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'yesterday') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}' AND created_at <= '${endDate.toISOString()}'`;
      } else if (timeframe === 'week') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'month') {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      } else if (timeframe === 'year') {
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        timeframeClause = `AND created_at >= '${startDate.toISOString()}'`;
      }
    }
    
    // Construct the query to get emotion averages for the specified category
    const emotionConditions = emotionsToSearch.map(emotion => `emotions ? '${emotion}'`).join(' OR ');
    
    const query = `
      WITH emotion_data AS (
        SELECT 
          e.emotion_key, 
          AVG(CAST(e.emotion_value AS FLOAT)) as avg_score,
          COUNT(*) as frequency
        FROM 
          "Journal Entries",
          jsonb_each_text(emotions) as e(emotion_key, emotion_value)
        WHERE 
          user_id = $1
          ${timeframeClause}
          AND (${emotionConditions})
        GROUP BY 
          e.emotion_key
        HAVING 
          e.emotion_key = ANY(ARRAY[${emotionsToSearch.map(e => `'${e}'`).join(', ')}])
      )
      SELECT 
        emotion_key,
        avg_score,
        frequency
      FROM 
        emotion_data
      ORDER BY 
        avg_score DESC
      LIMIT ${limit}
    `;
    
    const { data, error } = await supabase.rpc(
      'execute_dynamic_query',
      { query_text: query, param_values: [userId] }
    );
    
    if (error) {
      console.error("Error fetching top emotions by category:", error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      return { 
        success: false, 
        message: `No journal entries found with ${category} emotions`,
        category,
        timeframe: {
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate.toISOString()
        }
      };
    }
    
    // Format the results
    const formattedEmotions = data.map(row => ({
      name: row.emotion_key,
      score: Math.round(row.avg_score * 100) / 100,
      normalizedScore: Math.round((row.avg_score * 9) + 1),
      frequency: row.frequency
    }));
    
    return {
      success: true,
      category,
      emotions: formattedEmotions,
      timeframe: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate.toISOString()
      }
    };
  } catch (error) {
    console.error("Error in getTopEmotionsByCategory:", error);
    throw error;
  }
}

// Function to generate the final response using GPT
async function generateFinalResponse(
  userQuery: string,
  sqlResults: any[] | null,
  vectorResults: any[] | null,
  analysisJson: any,
  statisticsData: any = null,
  queryTypes: Record<string, boolean> = {},
  emotionalPeaksData: any = null,
  categoryEmotionsData: any = null
) {
  try {
    console.log("Generating final response with GPT");
    
    // Create context from SQL results
    let sqlContext = "No SQL results available.";
    if (sqlResults && sqlResults.length > 0) {
      sqlContext = `SQL Query Results (${sqlResults.length} rows):\n${JSON.stringify(sqlResults, null, 2)}`;
    }
    
    // Create context from vector similarity results
    let vectorContext = "No vector similarity results available.";
    if (vectorResults && vectorResults.length > 0) {
      vectorContext = `Vector Similarity Results (${vectorResults.length} entries):\n` +
        vectorResults.map((entry, i) => 
          `Entry ${i+1} (Similarity: ${entry.similarity?.toFixed(2) || 'N/A'}):\n${entry.content}`
        ).join('\n\n');
    }
    
    // Add emotional peaks context if available
    let peaksContext = "";
    if (emotionalPeaksData && emotionalPeaksData.success) {
      peaksContext = `
Emotional Peaks Analysis for "${emotionalPeaksData.emotion}":
${emotionalPeaksData.peaks.map((peak, i) => 
  `Peak ${i+1} (${new Date(peak.date).toLocaleDateString()}, Score: ${peak.score}):\n"${peak.text}"`
).join('\n\n')}
`;
    }
    
    // Add category emotions context if available
    let categoryEmotionsContext = "";
    if (categoryEmotionsData && categoryEmotionsData.success) {
      categoryEmotionsContext = `
Top ${categoryEmotionsData.category} Emotions:
${categoryEmotionsData.emotions.map((emotion, i) => 
  `${i+1}. ${emotion.name} (Score: ${emotion.normalizedScore}/10, Frequency: ${emotion.frequency} entries)`
).join('\n')}

Timeframe: ${categoryEmotionsData.timeframe.startDate ? 
  `From ${new Date(categoryEmotionsData.timeframe.startDate).toLocaleDateString()} to ${new Date(categoryEmotionsData.timeframe.endDate).toLocaleDateString()}` : 
  'All time'}
`;
    }
    
    // Add statistics context if available
    let statisticsContext = "";
    if (statisticsData && statisticsData.success) {
      statisticsContext = `
Statistical Analysis of Journal Emotions and Sentiments:
- Total Journal Entries: ${statisticsData.totalJournalEntries}
- Entries With Emotion Data: ${statisticsData.entriesWithEmotions}
- Dominant Emotion: ${statisticsData.dominantEmotion} (Score out of 10: ${statisticsData.dominantEmotionScore})

Top 5 Emotions (normalized to 1-10 scale):
${statisticsData.topEmotions.map(e => 
  `- ${e.name}: ${e.score}/10 (appears in ${e.frequency}% of entries)${e.isPositive ? ' (positive emotion)' : e.isNegative ? ' (negative emotion)' : ''}`
).join('\n')}

Data Timeframe: 
- Oldest Entry: ${statisticsData.timeframe.oldest ? new Date(statisticsData.timeframe.oldest).toLocaleDateString() : "None"}
- Newest Entry: ${statisticsData.timeframe.newest ? new Date(statisticsData.timeframe.newest).toLocaleDateString() : "None"}
${statisticsData.timeframe.startDate ? 
  `- Analysis Range: From ${new Date(statisticsData.timeframe.startDate).toLocaleDateString()} to ${new Date(statisticsData.timeframe.endDate).toLocaleDateString()}` : 
  ''}
`;

      // Add categorized emotion data if available
      if (statisticsData.emotionCategories) {
        statisticsContext += `
Positive Emotions:
${statisticsData.emotionCategories.positive.map(e => `- ${e.name}: ${e.score}/10 (appears in ${e.frequency}% of entries)`).join('\n')}

Negative Emotions:
${statisticsData.emotionCategories.negative.map(e => `- ${e.name}: ${e.score}/10 (appears in ${e.frequency}% of entries)`).join('\n')}
`;
      }

      // Add top entries examples for emotions if this is a "most" or "when" query
      if (queryTypes.isComparative || queryTypes.isTemporal) {
        // Find relevant emotions based on the query
        const queryLower = userQuery.toLowerCase();
        const relevantEmotions = Object.keys(statisticsData.emotionScores).filter(emotion => 
          queryLower.includes(emotion.toLowerCase())
        );
        
        // If specific emotions are mentioned, add their top entries
        if (relevantEmotions.length > 0) {
          statisticsContext += "\nTop entries for relevant emotions:\n";
          
          relevantEmotions.forEach(emotion => {
            const data = statisticsData.emotionScores[emotion];
            if (data && data.topEntries && data.topEntries.length > 0) {
              statisticsContext += `\n${emotion.toUpperCase()} - Top entries:\n`;
              data.topEntries.forEach((entry, i) => {
                const date = new Date(entry.date).toLocaleDateString();
                statisticsContext += `Entry ${i+1} (${date}, Score: ${(entry.score * 10).toFixed(1)}/10):\n"${entry.text}"\n`;
              });
            }
          });
        }
        // If no specific emotions are mentioned but it's a "most" query, include top entries for the dominant emotions
        else if (statisticsData.topEmotions.length > 0) {
          const topEmotion = statisticsData.topEmotions[0].name;
          const data = statisticsData.emotionScores[topEmotion];
          
          if (data && data.topEntries && data.topEntries.length > 0) {
            statisticsContext += `\nTop entries for ${topEmotion.toUpperCase()}:\n`;
            data.topEntries.forEach((entry, i) => {
              const date = new Date(entry.date).toLocaleDateString();
              statisticsContext += `Entry ${i+1} (${date}, Score: ${(entry.score * 10).toFixed(1)}/10):\n"${entry.text}"\n`;
            });
          }
        }
      }
    }
    
    // Combine all contexts
    const combinedContext = `
User Query: ${userQuery}

Analysis: ${analysisJson.analysis}

${sqlContext}

${vectorContext}

${statisticsContext}

${peaksContext}

${categoryEmotionsContext}
`;

    // System prompt for response generation
    let systemPrompt = `You are a helpful AI assistant named SOULo that helps users understand their journal entries.
Based on the user's query and the data provided below, generate a thoughtful, helpful response.
Focus on answering the user's question directly using the available data.
If the data doesn't contain relevant information to answer the query, acknowledge this limitation.
Keep your tone warm, supportive, and conversational.`;

    // Enhanced prompt for different query types
    if (queryTypes.isQuantitative || queryTypes.isComparative || queryTypes.asksForNumber) {
      systemPrompt += `\n\nSince this is a quantitative/comparative query:
- Present numerical data clearly and precisely
- Format all rankings and statistics in a clean, readable format (use markdown lists when appropriate)
- When presenting emotion scores, use a consistent 1-10 scale
- Make comparisons explicit when relevant (e.g., "Joy at 8/10 is your highest emotion, compared to Anxiety at 4/10")
- Include specific examples from journal entries to support your findings
- If trends are available, highlight changes over time
- For "top emotions" questions, clearly list them in order with their scores
- Use markdown formatting (e.g., **bold**, *italic*) to highlight key findings`;
    }

    if (queryTypes.isTemporal) {
      systemPrompt += `\n\nSince this is a temporal/"when" query:
- Be specific about dates and time periods in your answer
- Highlight the specific context from journal entries that correspond to the time period
- If asking about an emotional peak/valley, clearly state when it occurred and provide the relevant journal context
- For "when was I most sad" type questions, include direct quotes from the entries to explain why
- Use markdown formatting to make dates and timeframes stand out`;
    }

    if (queryTypes.isEmotionFocused) {
      systemPrompt += `\n\nSince this is an emotion-focused query:
- Clearly distinguish between positive emotions (e.g., happy, joy, excited, grateful) and negative emotions (e.g., sad, angry, anxious)
- Put emotion names in **bold** when listing them
- Provide context about when these emotions were strongest
- If comparing emotions, make the comparison explicit and clear
- Include relevant excerpts from journal entries that illustrate the emotions`;
    }

    systemPrompt += `\n\n${combinedContext}`;

    console.log("Sending context to GPT for final response");
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from GPT API:', errorText);
      throw new Error(`Failed to get response from GPT: ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error in generateFinalResponse:", error);
    throw error;
  }
}

// Enhanced query analysis function
function analyzeQueryTypes(query: string): Record<string, boolean> {
  const lowerQuery = query.toLowerCase();
  
  // Define keyword sets for better detection
  const quantitativeWords = [
    'how many', 'how much', 'count', 'total', 'average', 'avg', 'statistics',
    'stats', 'number', 'percentage', 'percent', 'ratio', 'frequency', 'score',
    'rate', 'top', 'bottom', 'most', 'least', 'highest', 'lowest', 'ranking',
    'rank', 'distribution', 'mean', 'median', 'majority', 'out of', 'scale'
  ];
  
  const comparativeWords = [
    'more than', 'less than', 'greater', 'smaller', 'better', 'worse', 'between',
    'compared to', 'versus', 'vs', 'difference', 'similar', 'most', 'least',
    'highest', 'lowest', 'top', 'bottom', 'maximum', 'minimum', 'max', 'min',
    'best', 'worst', 'stronger', 'weaker', 'dominant', 'primary', 'secondary'
  ];
  
  const temporalWords = [
    'when', 'time', 'date', 'period', 'duration', 'during', 'after', 'before',
    'since', 'until', 'day', 'week', 'month', 'year', 'today', 'yesterday',
    'tomorrow', 'recent', 'last', 'this', 'next', 'previous', 'upcoming',
    'now', 'past', 'future', 'earlier', 'later', 'history', 'trend'
  ];
  
  const emotionWords = [
    'feel', 'feeling', 'emotion', 'mood', 'happy', 'sad', 'angry', 'anxious',
    'joyful', 'excited', 'disappointed', 'frustrated', 'content', 'hopeful',
    'grateful', 'proud', 'afraid', 'scared', 'worried', 'stressed', 'peaceful',
    'calm', 'love', 'hate', 'fear', 'disgust', 'surprise', 'shame', 'guilt',
    'positive', 'negative', 'neutral'
  ];
  
  const numberWordPatterns = [
    /\b\d+\b/, /\bone\b/, /\btwo\b/, /\bthree\b/, /\bfour\b/, /\bfive\b/,
    /\bsix\b/, /\bseven\b/, /\beight\b/, /\bnine\b/, /\bten\b/, /\bdozen\b/,
    /\bhundred\b/, /\bthousand\b/, /\bmillion\b/, /\bbillion\b/, /\btrillion\b/,
    /\bfirst\b/, /\bsecond\b/, /\bthird\b/, /\blast\b/, /\bhalf\b/, /\btwice\b/,
    /\bdouble\b/, /\btriple\b/, /\bquadruple\b/, /\bquintuple\b/, /\bmultiple\b/
  ];
  
  // Check for top positive/negative emotions pattern
  const topEmotionsPattern = /top\s+\d+\s+(positive|negative)\s+emotions/i;
  
  // Check for quantitative query
  const hasQuantitativeWords = quantitativeWords.some(word => 
    lowerQuery.includes(word)
  );
  
  // Check for numbers in the query
  const hasNumbers = numberWordPatterns.some(pattern => 
    pattern.test(lowerQuery)
  );
  
  // Check for comparative query
  const hasComparativeWords = comparativeWords.some(word => 
    lowerQuery.includes(word)
  );
  
  // Check for temporal query
  const hasTemporalWords = temporalWords.some(word => 
    new RegExp(`\\b${word}\\b`).test(lowerQuery)
  );
  
  // Check for emotion focus
  const hasEmotionWords = emotionWords.some(word => 
    new RegExp(`\\b${word}\\b`).test(lowerQuery)
  );
  
  // Check for top emotions pattern
  const hasTopEmotionsPattern = topEmotionsPattern.test(lowerQuery);
  
  // Check for context understanding needs
  const needsContext = /\bwhy\b|\breason\b|\bcause\b|\bexplain\b|\bunderstand\b|\bmeaning\b|\binterpret\b/.test(lowerQuery);
  
  // Return comprehensive analysis
  return {
    // Quantitative patterns
    isQuantitative: hasQuantitativeWords || hasNumbers || hasTopEmotionsPattern,
    
    // Temporal patterns
    isTemporal: hasTemporalWords,
    
    // Comparative patterns
    isComparative: hasComparativeWords || hasTopEmotionsPattern,
    
    // Emotion specific patterns
    isEmotionFocused: hasEmotionWords || hasTopEmotionsPattern,
    
    // Top emotions pattern specifically
    hasTopEmotionsPattern,
    
    // Context understanding
    needsContext: needsContext,
    
    // Question asking for specific number 
    asksForNumber: hasNumbers || hasTopEmotionsPattern || /how many|how much|what percentage|how often|frequency|count|number of/i.test(lowerQuery),
    
    // Standard vector search still needed for semantic understanding
    needsVectorSearch: true
  };
}

// Detect timeframe from query
function detectTimeframe(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('today')) {
    return 'day';
  } else if (lowerQuery.includes('yesterday')) {
    return 'yesterday';
  } else if (lowerQuery.includes('last week') || lowerQuery.includes('this week') || 
      lowerQuery.includes('past week') || lowerQuery.includes('recent days')) {
    return 'week';
  } else if (lowerQuery.includes('last month') || lowerQuery.includes('this month') || 
      lowerQuery.includes('past month') || lowerQuery.includes('recent weeks')) {
    return 'month';
  } else if (lowerQuery.includes('last year') || lowerQuery.includes('this year') || 
      lowerQuery.includes('past year')) {
    return 'year';
  }
  
  return null;
}

// Main handler function for the edge function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const diagnostics = {
    timings: {
      total: 0,
      analysis: 0,
      embedding: 0,
      sqlExecution: 0,
      vectorSearch: 0,
      statisticsCalculation: 0,
      responseGeneration: 0
    },
    error: null,
    embeddingGenerated: false,
    embeddingError: null,
    similaritySearchComplete: false,
    searchError: null,
    contextBuilt: false,
    contextError: null,
    llmError: null,
    contextSize: 0,
    tokenCount: 0
  };

  try {
    const { message, userId, includeDiagnostics = false, queryTypes = {} } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Missing required parameters: message and userId');
    }

    console.log("Processing smart-chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Query types:", JSON.stringify(queryTypes));
    
    // Enhanced query analysis
    const analyzedQueryTypes = {
      ...analyzeQueryTypes(message),
      ...queryTypes
    };
    
    console.log("Enhanced query analysis:", JSON.stringify(analyzedQueryTypes));
    
    // Detect timeframe
    const timeframe = detectTimeframe(message);
    console.log("Detected timeframe:", timeframe);
    
    // Step 1: Ask GPT to analyze the query and generate SQL if needed
    const analysisStartTime = Date.now();
    const analysisJson = await analyzeQueryWithGPT(message, userId, analyzedQueryTypes);
    diagnostics.timings.analysis = Date.now() - analysisStartTime;
    
    console.log("Query analysis:", JSON.stringify(analysisJson));
    
    // Step 2: Generate embedding for the query (for vector search)
    let queryEmbedding = null;
    let vectorResults = null;
    let sqlResults = null;
    let sqlFilteredIds = null;
    let statisticsData = null;
    let emotionalPeaksData = null;
    let categoryEmotionsData = null;
    
    // Extract emotion and category from query for specialized processing
    const isPositiveEmotionsQuery = /positive emotions/i.test(message);
    const isNegativeEmotionsQuery = /negative emotions/i.test(message);
    const emotionMatch = message.match(/\b(happy|sad|angry|anxious|excited|content|joy|grateful|peaceful|hopeful|frustrated|stressed|worried)\b/i);
    const emotion = emotionMatch ? emotionMatch[0].toLowerCase() : null;
    
    // Step 3: Execute SQL query if needed
    if (analysisJson.requiresSql) {
      const sqlStartTime = Date.now();
      try {
        const sqlResult = await executeSqlQuery(analysisJson.sqlQuery, userId);
        sqlResults = sqlResult.data;
        console.log("SQL query results:", sqlResults ? sqlResults.length : 0);
        
        // If we have SQL results and need vector search, extract IDs for filtering
        if (analysisJson.requiresVectorSearch && sqlResults && sqlResults.length > 0) {
          sqlFilteredIds = sqlResults
            .filter(row => row.id !== undefined && row.id !== null)
            .map(row => Number(row.id))
            .filter(id => !isNaN(id));
        }
        
        diagnostics.timings.sqlExecution = Date.now() - sqlStartTime;
      } catch (sqlError) {
        console.error("Error executing SQL:", sqlError);
        // Continue with vector search if applicable
        diagnostics.error = `SQL execution error: ${sqlError.message}`;
      }
    }
    
    // Step 3.5: Calculate statistics for quantitative and comparative queries
    if (analyzedQueryTypes.isQuantitative || analyzedQueryTypes.isComparative || analyzedQueryTypes.isTemporal) {
      const statsStartTime = Date.now();
      try {
        statisticsData = await calculateEmotionStatistics(userId, timeframe);
        console.log("Statistics calculated successfully");
        diagnostics.timings.statisticsCalculation = Date.now() - statsStartTime;
      } catch (statsError) {
        console.error("Error calculating statistics:", statsError);
        if (!diagnostics.error) {
          diagnostics.error = `Statistics calculation error: ${statsError.message}`;
        } else {
          diagnostics.error += `; Statistics calculation error: ${statsError.message}`;
        }
      }
    }
    
    // Step 3.6: Specialized processing for top positive/negative emotions
    if (analyzedQueryTypes.hasTopEmotionsPattern) {
      const categoryStartTime = Date.now();
      try {
        // Determine if query is about positive or negative emotions
        const category = isPositiveEmotionsQuery ? 'positive' : isNegativeEmotionsQuery ? 'negative' : null;
        
        if (category) {
          // Extract limit from query (default to 3)
          const limitMatch = message.match(/top\s+(\d+)/i);
          const limit = limitMatch ? parseInt(limitMatch[1]) : 3;
          
          categoryEmotionsData = await getTopEmotionsByCategory(userId, category, limit, timeframe);
          console.log(`Top ${category} emotions retrieved:`, 
            categoryEmotionsData.success ? categoryEmotionsData.emotions.length : 'none');
        }
      } catch (categoryError) {
        console.error("Error processing category emotions:", categoryError);
      }
    }
    
    // Step 3.7: For emotional queries, get specific peak data
    if (analyzedQueryTypes.isEmotionFocused && emotion) {
      const peaksStartTime = Date.now();
      
      try {
        emotionalPeaksData = await findEmotionalPeaks(userId, emotion, 3, timeframe);
        console.log(`Found emotional peaks for ${emotion}:`, 
          emotionalPeaksData.success ? emotionalPeaksData.peaks.length : 'none');
      } catch (peaksError) {
        console.error("Error finding emotional peaks:", peaksError);
      }
    }
    
    // Step 4: Perform vector similarity search if needed
    if (analysisJson.requiresVectorSearch && !categoryEmotionsData?.success) {
      const embeddingStartTime = Date.now();
      
      try {
        // Use the specified vector search text if available, otherwise use the original query
        const vectorSearchText = analysisJson.vectorSearchText || message;
        queryEmbedding = await generateEmbedding(vectorSearchText);
        diagnostics.embeddingGenerated = true;
        diagnostics.timings.embedding = Date.now() - embeddingStartTime;
        
        const vectorStartTime = Date.now();
        vectorResults = await performVectorSearch(
          queryEmbedding, 
          userId,
          sqlFilteredIds
        );
        diagnostics.similaritySearchComplete = true;
        diagnostics.timings.vectorSearch = Date.now() - vectorStartTime;
      } catch (vectorError) {
        console.error("Error in vector search:", vectorError);
        diagnostics.embeddingError = vectorError.message;
        diagnostics.searchError = vectorError.message;
        // Continue with SQL results if available
        if (!diagnostics.error) {
          diagnostics.error = `Vector search error: ${vectorError.message}`;
        } else {
          diagnostics.error += `; Vector search error: ${vectorError.message}`;
        }
      }
    }
    
    // Step 5: Generate final response with GPT
    const responseStartTime = Date.now();
    try {
      diagnostics.contextBuilt = true;
      const estimatedContextSize = 
        JSON.stringify(sqlResults).length + 
        JSON.stringify(vectorResults).length +
        JSON.stringify(statisticsData).length +
        JSON.stringify(emotionalPeaksData).length +
        JSON.stringify(categoryEmotionsData).length;
      diagnostics.contextSize = estimatedContextSize;
      
      const finalResponse = await generateFinalResponse(
        message, 
        sqlResults, 
        vectorResults,
        analysisJson,
        statisticsData,
        analyzedQueryTypes,
        emotionalPeaksData,
        categoryEmotionsData
      );
      diagnostics.timings.responseGeneration = Date.now() - responseStartTime;
      diagnostics.tokenCount = Math.round(finalResponse.length / 4); // Very rough estimation
      
      // Calculate total time
      diagnostics.timings.total = Date.now() - startTime;
      
      // Prepare response object with references
      const responseObject: any = {
        response: finalResponse,
        analysis: analysisJson
      };
      
      // Add references from vector search or SQL results
      if (vectorResults && vectorResults.length > 0) {
        responseObject.references = vectorResults.map(item => ({
          id: item.id,
          date: item.created_at,
          snippet: item.content.substring(0, 200) + (item.content.length > 200 ? "..." : ""),
          similarity: item.similarity
        }));
      } else if (sqlResults && sqlResults.length > 0 && sqlResults[0]["refined text"]) {
        // Try to extract meaningful references from SQL results if they contain text
        responseObject.references = sqlResults
          .filter(item => item["refined text"] || item.content)
          .slice(0, 5)
          .map(item => ({
            id: item.id,
            date: item.created_at,
            snippet: (item["refined text"] || item.content).substring(0, 200) + 
              ((item["refined text"] || item.content).length > 200 ? "..." : ""),
            emotions: item.emotions,
            themes: item.master_themes
          }));
      }
      
      // Include additional data if diagnostics requested
      if (includeDiagnostics) {
        responseObject.diagnostics = diagnostics;
        responseObject.queryAnalysis = {
          queryType: analyzedQueryTypes.isEmotionFocused ? 'emotional' : 
                    analyzedQueryTypes.isTemporal ? 'temporal' : 
                    analyzedQueryTypes.isQuantitative ? 'quantitative' : 'general',
          emotion: emotion,
          isPositiveQuery: isPositiveEmotionsQuery,
          isNegativeQuery: isNegativeEmotionsQuery,
          timeframe: {
            timeType: timeframe,
            startDate: statisticsData?.timeframe?.startDate || null,
            endDate: statisticsData?.timeframe?.endDate || null
          },
          analyzedTypes: analyzedQueryTypes
        };
        
        // Include SQL and vector results for debugging
        if (sqlResults) {
          responseObject.sqlResults = sqlResults;
        }
        
        if (vectorResults) {
          responseObject.similarityScores = vectorResults.map(item => ({
            id: item.id,
            score: item.similarity
          }));
        }
        
        if (statisticsData) {
          responseObject.statisticsData = statisticsData;
        }
        
        if (emotionalPeaksData) {
          responseObject.emotionalPeaksData = emotionalPeaksData;
        }
        
        if (categoryEmotionsData) {
          responseObject.categoryEmotionsData = categoryEmotionsData;
        }
      }
      
      return new Response(
        JSON.stringify(responseObject),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (responseError) {
      console.error("Error generating final response:", responseError);
      diagnostics.llmError = responseError.message;
      throw responseError;
    }
  } catch (error) {
    console.error("Error in smart-chat function:", error);
    
    diagnostics.timings.total = Date.now() - startTime;
    diagnostics.error = error.message;
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        response: "I'm having trouble processing your request. Please try again later.",
        diagnostics: diagnostics
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
