
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

Common Emotion Analysis SQL Patterns:
1. Finding top emotions across all entries:
   SELECT emotion_key, AVG(CAST(emotion_value AS FLOAT)) as avg_score
   FROM "Journal Entries",
        jsonb_each_text(emotions) as e(emotion_key, emotion_value)
   WHERE user_id = $1
   GROUP BY emotion_key
   ORDER BY avg_score DESC
   LIMIT 3;

2. Finding when a specific emotion was strongest:
   SELECT id, created_at, CAST(emotions->>'sad' AS FLOAT) as emotion_score, "refined text"
   FROM "Journal Entries"
   WHERE user_id = $1 AND emotions->>'sad' IS NOT NULL
   ORDER BY emotion_score DESC
   LIMIT 1;

3. Comparing positive vs negative emotions:
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

4. Finding emotional trends over time:
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

For the emotions jsonb field, consider:
- It contains key-value pairs where keys are emotion names like "happy", "sad", "angry", "anxious", "excited"
- Values are floating point numbers between 0 and 1 representing the intensity of the emotion
- Not all entries will have all emotions, so handle NULLs appropriately
- For "positive emotions" generally consider: happy, joy, excited, content, grateful
- For "negative emotions" generally consider: sad, angry, anxious, disappointed, frustrated`;

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
- If comparing positive vs negative emotions, group them appropriately in your query`;
    }

    if (queryTypes.isTemporal) {
      systemPrompt += `\n\nSPECIAL INSTRUCTIONS FOR TEMPORAL QUERIES:
- For "when" questions, focus on extracting and formatting dates appropriately
- Use date_trunc to aggregate data by relevant time periods (day, week, month, etc.)
- Consider returning the actual dates of peak emotions or events
- For questions about trends over time, generate SQL that groups by time periods
- Use EXTRACT() functions to get specific components of dates when needed
- For questions about "most sad and why", include content from the journal to explain why`;
    }

    if (queryTypes.isEmotionFocused) {
      systemPrompt += `\n\nSPECIAL INSTRUCTIONS FOR EMOTION-FOCUSED QUERIES:
- Use jsonb_object_keys(emotions) to extract all emotion keys when needed
- For specific emotions, access their values using emotions->>'emotion_name' with CAST() to convert to float
- Consider the relative intensities of emotions (higher scores = stronger emotions)
- For complex emotion analysis, you may need to cross-reference with the text content
- Use conditional logic to categorize emotions as needed (e.g., CASE WHEN)
- For "positive" vs "negative" emotions, group them appropriately in your analysis`;
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
async function calculateEmotionStatistics(userId: string) {
  try {
    console.log("Calculating enhanced emotion statistics");
    
    // Query to get all journal entries with emotions
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('emotions, created_at, sentiment, "refined text"')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
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
          id: idx, // Using index as a placeholder since we don't have the actual ID
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
        topEntries: stats.entries.map(entry => ({
          date: entry.date,
          score: entry.score,
          text: entry.text.substring(0, 150) + (entry.text.length > 150 ? "..." : "")
        }))
      };
    });
    
    // Get overall sentiment distribution
    const { data: sentimentData, error: sentimentError } = await supabase
      .from('Journal Entries')
      .select('sentiment, created_at')
      .eq('user_id', userId)
      .not('sentiment', 'is', null);
      
    if (sentimentError) {
      console.error("Error fetching sentiment data:", sentimentError);
    }
    
    const sentimentCounts: Record<string, number> = {};
    const sentimentByMonth: Record<string, Record<string, number>> = {};
    const totalSentimentEntries = sentimentData?.length || 0;
    
    if (sentimentData && sentimentData.length > 0) {
      sentimentData.forEach(entry => {
        if (!entry.sentiment) return;
        
        // Count overall sentiments
        sentimentCounts[entry.sentiment] = (sentimentCounts[entry.sentiment] || 0) + 1;
        
        // Group sentiments by month for trend analysis
        if (entry.created_at) {
          const monthYear = new Date(entry.created_at).toISOString().substring(0, 7); // YYYY-MM format
          if (!sentimentByMonth[monthYear]) {
            sentimentByMonth[monthYear] = {};
          }
          
          sentimentByMonth[monthYear][entry.sentiment] = 
            (sentimentByMonth[monthYear][entry.sentiment] || 0) + 1;
        }
      });
    }
    
    // Calculate sentiment percentages
    const sentimentPercentages: Record<string, number> = {};
    Object.entries(sentimentCounts).forEach(([sentiment, count]) => {
      sentimentPercentages[sentiment] = Math.round((count / totalSentimentEntries) * 100);
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
    
    const averageSentiment = Object.keys(sentimentPercentages).length > 0 
      ? Object.entries(sentimentPercentages).reduce((highest, [sentiment, percentage]) => {
          return percentage > (sentimentPercentages[highest] || 0) ? sentiment : highest;
        }, Object.keys(sentimentPercentages)[0])
      : null;
      
    // Calculate emotion trends over time
    const emotionTrends = await calculateEmotionTrends(userId);
    
    // Group emotions into positive and negative categories
    const positiveEmotions = ['happy', 'joy', 'excited', 'content', 'grateful', 'peaceful', 'hopeful'];
    const negativeEmotions = ['sad', 'angry', 'anxious', 'disappointed', 'frustrated', 'fearful', 'stressed'];
    
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
          frequency: Math.round(data.frequency)
        })),
      bottomEmotions: Object.entries(emotionAverages)
        .sort(([, a], [, b]) => a.normalizedScore - b.normalizedScore)
        .slice(0, 5)
        .map(([emotion, data]) => ({ 
          name: emotion, 
          score: data.normalizedScore,
          frequency: Math.round(data.frequency)
        })),
      emotionCategories,
      dominantEmotion,
      dominantEmotionScore: emotionAverages[dominantEmotion]?.normalizedScore || 0,
      sentimentDistribution: sentimentPercentages,
      sentimentTrends: sentimentByMonth,
      predominantSentiment: averageSentiment,
      emotionTrends,
      timeframe: {
        oldest: entries.length > 0 ? entries[entries.length - 1].created_at : null,
        newest: entries.length > 0 ? entries[0].created_at : null
      }
    };
  } catch (error) {
    console.error("Error calculating emotion statistics:", error);
    throw error;
  }
}

// Function to calculate emotion trends over time
async function calculateEmotionTrends(userId: string) {
  try {
    // Get all entries with emotions
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('emotions, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
      
    if (error || !entries || entries.length === 0) {
      return null;
    }
    
    // Group by month
    const monthlyEmotions: Record<string, Record<string, number[]>> = {};
    
    entries.forEach(entry => {
      if (!entry.emotions || !entry.created_at) return;
      
      const monthYear = new Date(entry.created_at).toISOString().substring(0, 7); // YYYY-MM format
      if (!monthlyEmotions[monthYear]) {
        monthlyEmotions[monthYear] = {};
      }
      
      Object.entries(entry.emotions).forEach(([emotion, score]) => {
        const numericScore = typeof score === 'string' ? parseFloat(score) : (score as number);
        
        if (!monthlyEmotions[monthYear][emotion]) {
          monthlyEmotions[monthYear][emotion] = [];
        }
        
        monthlyEmotions[monthYear][emotion].push(numericScore);
      });
    });
    
    // Calculate averages by month
    const emotionTrends: Record<string, Array<{month: string, average: number}>> = {};
    
    Object.entries(monthlyEmotions).forEach(([month, emotions]) => {
      Object.entries(emotions).forEach(([emotion, scores]) => {
        if (!emotionTrends[emotion]) {
          emotionTrends[emotion] = [];
        }
        
        const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        emotionTrends[emotion].push({
          month,
          average
        });
      });
    });
    
    // Sort each emotion's trend data by month
    Object.keys(emotionTrends).forEach(emotion => {
      emotionTrends[emotion].sort((a, b) => a.month.localeCompare(b.month));
    });
    
    return emotionTrends;
  } catch (error) {
    console.error("Error calculating emotion trends:", error);
    return null;
  }
}

// Function to find emotional peaks and when they occurred
async function findEmotionalPeaks(userId: string, emotion: string, limit: number = 3) {
  try {
    console.log(`Finding peaks for emotion: ${emotion}`);
    
    // Find entries with the highest score for the specified emotion
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at, emotions, "refined text"')
      .eq('user_id', userId)
      .not('emotions', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching emotion peaks:", error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      return { success: false, message: "No journal entries found" };
    }
    
    // Filter entries that have the specified emotion
    const entriesWithEmotion = data
      .filter(entry => 
        entry.emotions && 
        entry.emotions[emotion] !== undefined && 
        entry.emotions[emotion] !== null
      )
      .map(entry => ({
        id: entry.id,
        date: entry.created_at,
        score: typeof entry.emotions[emotion] === 'string' 
          ? parseFloat(entry.emotions[emotion]) 
          : entry.emotions[emotion],
        text: entry["refined text"] || ""
      }));
    
    if (entriesWithEmotion.length === 0) {
      return { 
        success: false, 
        message: `No entries found with emotion: ${emotion}` 
      };
    }
    
    // Sort by emotion score (descending)
    entriesWithEmotion.sort((a, b) => b.score - a.score);
    
    // Get the top N entries
    const peakEntries = entriesWithEmotion.slice(0, limit);
    
    return {
      success: true,
      emotion,
      peaks: peakEntries.map(entry => ({
        date: entry.date,
        score: Math.round(entry.score * 100) / 100,
        text: entry.text.substring(0, 200) + (entry.text.length > 200 ? "..." : "")
      }))
    };
  } catch (error) {
    console.error("Error in findEmotionalPeaks:", error);
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
  emotionalPeaksData: any = null
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
          `Entry ${i+1} (Similarity: ${entry.similarity.toFixed(2)}):\n${entry.content}`
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
    
    // Add statistics context if available
    let statisticsContext = "";
    if (statisticsData && statisticsData.success) {
      statisticsContext = `
Statistical Analysis of Journal Emotions and Sentiments:
- Total Journal Entries: ${statisticsData.totalJournalEntries}
- Entries With Emotion Data: ${statisticsData.entriesWithEmotions}
- Dominant Emotion: ${statisticsData.dominantEmotion} (Score out of 10: ${statisticsData.dominantEmotionScore})
- Predominant Sentiment: ${statisticsData.predominantSentiment || "Not available"}

Top 5 Emotions (normalized to 1-10 scale):
${statisticsData.topEmotions.map(e => `- ${e.name}: ${e.score}/10 (appears in ${e.frequency}% of entries)`).join('\n')}

Bottom 5 Emotions:
${statisticsData.bottomEmotions.map(e => `- ${e.name}: ${e.score}/10 (appears in ${e.frequency}% of entries)`).join('\n')}

Sentiment Distribution:
${Object.entries(statisticsData.sentimentDistribution || {})
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([sentiment, percentage]) => `- ${sentiment}: ${percentage}%`)
  .join('\n')}

Data Timeframe: 
- Oldest Entry: ${statisticsData.timeframe.oldest ? new Date(statisticsData.timeframe.oldest).toLocaleDateString() : "None"}
- Newest Entry: ${statisticsData.timeframe.newest ? new Date(statisticsData.timeframe.newest).toLocaleDateString() : "None"}
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

${analysisJson.requiresSql ? sqlContext : ''}

${analysisJson.requiresVectorSearch ? vectorContext : ''}

${statisticsContext}

${peaksContext}
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
- For "top emotions" questions, clearly list them in order with their scores`;
    }

    if (queryTypes.isTemporal) {
      systemPrompt += `\n\nSince this is a temporal/"when" query:
- Be specific about dates and time periods in your answer
- Highlight the specific context from journal entries that correspond to the time period
- If asking about an emotional peak/valley, clearly state when it occurred and provide the relevant journal context
- For "when was I most sad" type questions, include direct quotes from the entries to explain why`;
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
    error: null
  };

  try {
    const { message, userId, includeDiagnostics = false, queryTypes = {} } = await req.json();
    
    if (!message || !userId) {
      throw new Error('Missing required parameters: message and userId');
    }

    console.log("Processing smart-chat request for user:", userId);
    console.log("Message:", message.substring(0, 50) + "...");
    console.log("Query types:", JSON.stringify(queryTypes));
    
    // Determine if this is likely a quantitative query based on the queryTypes
    const isLikelyQuantitative = queryTypes.isQuantitative || queryTypes.isComparative || queryTypes.asksForNumber;
    const isTemporalEmotionQuery = queryTypes.isTemporal && queryTypes.isEmotionFocused;
    
    // Step 1: Ask GPT to analyze the query and generate SQL if needed
    const analysisStartTime = Date.now();
    const analysisJson = await analyzeQueryWithGPT(message, userId, queryTypes);
    diagnostics.timings.analysis = Date.now() - analysisStartTime;
    
    console.log("Query analysis:", JSON.stringify(analysisJson));
    
    // Step 2: Generate embedding for the query (for vector search)
    let queryEmbedding = null;
    let vectorResults = null;
    let sqlResults = null;
    let sqlFilteredIds = null;
    let statisticsData = null;
    let emotionalPeaksData = null;
    
    // Step 3: Execute SQL query if needed
    if (analysisJson.requiresSql) {
      const sqlStartTime = Date.now();
      try {
        const sqlResult = await executeSqlQuery(analysisJson.sqlQuery, userId);
        sqlResults = sqlResult.data;
        
        // If we have SQL results and need vector search, extract IDs for filtering
        if (analysisJson.requiresVectorSearch && sqlResults && sqlResults.length > 0) {
          sqlFilteredIds = sqlResults.map(row => Number(row.id)).filter(id => !isNaN(id));
        }
        
        diagnostics.timings.sqlExecution = Date.now() - sqlStartTime;
      } catch (sqlError) {
        console.error("Error executing SQL:", sqlError);
        // Continue with vector search if applicable
        diagnostics.error = `SQL execution error: ${sqlError.message}`;
      }
    }
    
    // Step 3.5: Calculate statistics for quantitative and comparative queries
    if (isLikelyQuantitative || queryTypes.isTemporal) {
      const statsStartTime = Date.now();
      try {
        statisticsData = await calculateEmotionStatistics(userId);
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
    
    // Step 3.6: For temporal emotion queries (like "when was I most sad"), get specific peak data
    if (isTemporalEmotionQuery) {
      const peaksStartTime = Date.now();
      
      try {
        // Extract the emotion from the query
        const lowerQuery = message.toLowerCase();
        const emotionWords = [
          'happy', 'sad', 'angry', 'anxious', 'excited', 'content', 
          'frustrated', 'stressed', 'grateful', 'peaceful', 'hopeful'
        ];
        
        const matchedEmotion = emotionWords.find(emotion => lowerQuery.includes(emotion));
        
        if (matchedEmotion) {
          emotionalPeaksData = await findEmotionalPeaks(userId, matchedEmotion);
          console.log(`Found emotional peaks for ${matchedEmotion}:`, 
            emotionalPeaksData.success ? emotionalPeaksData.peaks.length : 'none');
        }
      } catch (peaksError) {
        console.error("Error finding emotional peaks:", peaksError);
      }
    }
    
    // Step 4: Perform vector similarity search if needed
    if (analysisJson.requiresVectorSearch) {
      const embeddingStartTime = Date.now();
      
      try {
        // Use the specified vector search text if available, otherwise use the original query
        const vectorSearchText = analysisJson.vectorSearchText || message;
        queryEmbedding = await generateEmbedding(vectorSearchText);
        diagnostics.timings.embedding = Date.now() - embeddingStartTime;
        
        const vectorStartTime = Date.now();
        vectorResults = await performVectorSearch(
          queryEmbedding, 
          userId,
          sqlFilteredIds
        );
        diagnostics.timings.vectorSearch = Date.now() - vectorStartTime;
      } catch (vectorError) {
        console.error("Error in vector search:", vectorError);
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
    const finalResponse = await generateFinalResponse(
      message, 
      sqlResults, 
      vectorResults,
      analysisJson,
      statisticsData,
      queryTypes,
      emotionalPeaksData
    );
    diagnostics.timings.responseGeneration = Date.now() - responseStartTime;
    
    // Calculate total time
    diagnostics.timings.total = Date.now() - startTime;
    
    // Prepare response object
    const responseObject = {
      response: finalResponse,
      analysis: analysisJson
    };
    
    // Include additional data if diagnostics requested
    if (includeDiagnostics) {
      responseObject.diagnostics = diagnostics;
      
      // Include SQL and vector results for debugging
      if (sqlResults) {
        responseObject.sqlResults = sqlResults;
      }
      
      if (vectorResults) {
        responseObject.vectorResults = vectorResults;
      }
      
      if (statisticsData) {
        responseObject.statisticsData = statisticsData;
      }
      
      if (emotionalPeaksData) {
        responseObject.emotionalPeaksData = emotionalPeaksData;
      }
    }
    
    return new Response(
      JSON.stringify(responseObject),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
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
