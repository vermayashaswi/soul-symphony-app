
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get OpenAI API key from environment variable
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set');
  Deno.exit(1);
}

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Parse the request body
    const { userId, query, dateRange, emotions, themes, contentKeywords, relevanceThreshold = 0.6, limit = 10 } = await req.json();

    if (!userId || !query) {
      throw new Error('User ID and query are required');
    }

    console.log(`[SmartQueryFilter] Processing filter for user ${userId}: ${query.substring(0, 50)}...`);
    
    // Step 1: Generate query embedding for similarity search
    const queryEmbedding = await generateEmbedding(query);
    
    // Step 2: Use OpenAI to extract potential filters from the query
    const extractedFilters = await extractQueryFilters(query);
    
    // Combine extracted filters with provided filters
    const combinedDateRange = dateRange || extractedFilters.dateRange;
    const combinedEmotions = emotions || extractedFilters.emotions;
    const combinedThemes = themes || extractedFilters.themes;
    const combinedKeywords = contentKeywords || extractedFilters.keywords;
    
    console.log(`[SmartQueryFilter] Extracted filters:`, extractedFilters);
    
    // Step 3: Build and execute the database query with filters
    let filteredEntries = [];
    let totalCount = 0;
    
    // First, get the total count of potential entries
    const { count, error: countError } = await supabase
      .from('Journal')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (countError) {
      console.error('[SmartQueryFilter] Error counting entries:', countError);
    } else {
      totalCount = count || 0;
    }
    
    // Use vector search with additional filters
    if (combinedDateRange || combinedEmotions || combinedThemes) {
      let entries;
      
      // Use the match_journal_entries_with_date function if we have date filters
      if (combinedDateRange?.startDate && combinedDateRange?.endDate) {
        const { data, error } = await supabase.rpc(
          'match_journal_entries_with_date',
          {
            query_embedding: queryEmbedding,
            match_threshold: relevanceThreshold,
            match_count: limit,
            user_id_filter: userId,
            start_date: combinedDateRange.startDate,
            end_date: combinedDateRange.endDate
          }
        );
        
        if (error) {
          console.error('[SmartQueryFilter] Error in vector search with date:', error);
        } else {
          entries = data || [];
        }
      } else {
        // Use the basic match_journal_entries_fixed function
        const { data, error } = await supabase.rpc(
          'match_journal_entries_fixed',
          {
            query_embedding: queryEmbedding,
            match_threshold: relevanceThreshold,
            match_count: limit * 2, // Get more entries to filter later
            user_id_filter: userId
          }
        );
        
        if (error) {
          console.error('[SmartQueryFilter] Error in vector search:', error);
        } else {
          entries = data || [];
        }
      }
      
      // Apply additional filtering on emotions and themes
      if (entries && entries.length > 0) {
        filteredEntries = entries.filter(entry => {
          // Filter by emotions if specified
          if (combinedEmotions && combinedEmotions.length > 0 && entry.emotions) {
            const hasMatchingEmotion = combinedEmotions.some(emotion => 
              entry.emotions && typeof entry.emotions === 'object' && 
              Object.keys(entry.emotions).some(e => 
                e.toLowerCase().includes(emotion.toLowerCase())
              )
            );
            if (!hasMatchingEmotion) return false;
          }
          
          // Filter by themes if specified
          if (combinedThemes && combinedThemes.length > 0 && entry.master_themes) {
            const hasMatchingTheme = combinedThemes.some(theme => 
              entry.master_themes && Array.isArray(entry.master_themes) &&
              entry.master_themes.some(t => 
                t.toLowerCase().includes(theme.toLowerCase())
              )
            );
            if (!hasMatchingTheme) return false;
          }
          
          // Additional keyword filtering in content if needed
          if (combinedKeywords && combinedKeywords.length > 0 && entry.content) {
            const contentLower = entry.content.toLowerCase();
            const hasMatchingKeyword = combinedKeywords.some(keyword => 
              contentLower.includes(keyword.toLowerCase())
            );
            if (!hasMatchingKeyword) return false;
          }
          
          return true;
        });
        
        // Limit the results
        filteredEntries = filteredEntries.slice(0, limit);
      }
    } else {
      // If no specific filters, just use vector similarity
      const { data, error } = await supabase.rpc(
        'match_journal_entries_fixed',
        {
          query_embedding: queryEmbedding,
          match_threshold: relevanceThreshold,
          match_count: limit,
          user_id_filter: userId
        }
      );
      
      if (error) {
        console.error('[SmartQueryFilter] Error in basic vector search:', error);
      } else {
        filteredEntries = data || [];
      }
    }
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Compile the list of applied filters for diagnostics
    const appliedFilters = [];
    if (combinedDateRange?.startDate) appliedFilters.push(`date:${combinedDateRange.startDate.slice(0,10)}-${combinedDateRange.endDate?.slice(0,10) || 'now'}`);
    if (combinedEmotions?.length) appliedFilters.push(`emotions:${combinedEmotions.join(',')}`);
    if (combinedThemes?.length) appliedFilters.push(`themes:${combinedThemes.join(',')}`);
    if (combinedKeywords?.length) appliedFilters.push(`keywords:${combinedKeywords.join(',')}`);
    if (relevanceThreshold !== 0.6) appliedFilters.push(`similarity:${relevanceThreshold}`);
    
    // Return the filtered entries and diagnostic information
    return new Response(JSON.stringify({
      entries: filteredEntries,
      totalCount,
      filteredCount: filteredEntries.length,
      appliedFilters,
      extractedFilters,
      processingTime,
      query
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error('[SmartQueryFilter] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processingTime: Date.now() - startTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to generate an embedding for a text
async function generateEmbedding(text) {
  try {
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('Failed to generate embedding:', error);
      throw new Error('Failed to generate embedding for the query');
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.data || embeddingData.data.length === 0) {
      throw new Error('No embedding generated');
    }
    
    return embeddingData.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

// Helper function to extract filter parameters from a query using OpenAI
async function extractQueryFilters(query) {
  try {
    const prompt = `
    Extract relevant filter parameters from this journaling query:
    "${query}"
    
    Please identify:
    1. Date range (specific dates, "last week", "last month", "this year", etc.)
    2. Emotions mentioned (e.g., happy, sad, anxious, etc.)
    3. Themes or topics (e.g., work, relationships, health, etc.)
    4. Important keywords
    
    Output as JSON with dateRange (startDate, endDate), emotions (array), themes (array), and keywords (array).
    If something isn't present, leave it null or as an empty array.
    `;
    
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error('[SmartQueryFilter] OpenAI filter extraction error:', errorText);
      return {
        dateRange: null,
        emotions: [],
        themes: [],
        keywords: []
      };
    }

    const completionData = await completion.json();
    const filterData = JSON.parse(completionData.choices[0].message.content);
    
    // Convert any relative date references to actual dates
    if (filterData.dateRange) {
      const { dateRange } = filterData;
      if (typeof dateRange === 'string') {
        // Handle text descriptions like "last week", "last month"
        const dates = convertRelativeDateToRange(dateRange);
        filterData.dateRange = dates;
      } else if (!dateRange.startDate && !dateRange.endDate) {
        filterData.dateRange = null;
      }
    }
    
    return filterData;
  } catch (error) {
    console.error('[SmartQueryFilter] Error extracting filters:', error);
    return {
      dateRange: null,
      emotions: [],
      themes: [],
      keywords: []
    };
  }
}

// Helper function to convert relative date references to actual date ranges
function convertRelativeDateToRange(dateText) {
  const now = new Date();
  let startDate = null;
  let endDate = null;
  
  const lowerText = dateText.toLowerCase();
  
  if (lowerText.includes('last week') || lowerText.includes('previous week')) {
    // Last week: 7-13 days ago
    const end = new Date(now);
    end.setDate(now.getDate() - 7);
    endDate = end.toISOString();
    
    const start = new Date(now);
    start.setDate(now.getDate() - 14);
    startDate = start.toISOString();
  } 
  else if (lowerText.includes('last month') || lowerText.includes('previous month')) {
    // Last month: previous calendar month
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate = start.toISOString();
    
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    endDate = end.toISOString();
  }
  else if (lowerText.includes('this year')) {
    // This year: from Jan 1 to current date
    const start = new Date(now.getFullYear(), 0, 1);
    startDate = start.toISOString();
    endDate = now.toISOString();
  }
  else if (lowerText.includes('last year') || lowerText.includes('previous year')) {
    // Last year: previous calendar year
    const start = new Date(now.getFullYear() - 1, 0, 1);
    startDate = start.toISOString();
    
    const end = new Date(now.getFullYear() - 1, 11, 31);
    endDate = end.toISOString();
  }
  else if (lowerText.includes('this month')) {
    // This month: from 1st of current month to now
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate = start.toISOString();
    endDate = now.toISOString();
  }
  else if (lowerText.includes('today')) {
    // Today: from start of today to now
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    startDate = start.toISOString();
    endDate = now.toISOString();
  }
  else if (lowerText.includes('yesterday')) {
    // Yesterday: previous day
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    startDate = start.toISOString();
    
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    endDate = end.toISOString();
  }
  
  return { startDate, endDate };
}
