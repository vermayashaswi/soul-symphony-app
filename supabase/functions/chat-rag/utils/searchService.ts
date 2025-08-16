
// Standard vector search without time filtering
export async function searchEntriesWithVector(
  supabase: any,
  userId: string, 
  queryEmbedding: number[]
) {
  try {
    console.log(`[SearchService] Searching entries with vector similarity for userId: ${userId}`);
    console.log(`[SearchService] Query embedding dimensions: ${queryEmbedding.length}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 10,
        user_id_filter: userId
      }
    );
    
    if (error) {
      console.error(`[SearchService] Error in vector search: ${error.message}`);
      console.error(`[SearchService] Full error:`, error);
      throw error;
    }
    
    console.log(`[SearchService] Found ${data?.length || 0} entries with vector similarity`);
    
    // Add detailed logging of results
    if (data && data.length > 0) {
      console.log("[SearchService] Vector search results:", 
        data.map((entry: any) => ({
          id: entry.id,
          date: new Date(entry.created_at).toISOString(),
          similarity: entry.similarity,
          hasEmbedding: !!entry.embedding
        }))
      );
    }
    
    return data || [];
  } catch (error) {
    console.error('[SearchService] Error searching entries with vector:', error);
    throw error;
  }
}

// Time-filtered vector search using the fixed function
export async function searchEntriesWithTimeRange(
  supabase: any,
  userId: string, 
  queryEmbedding: number[], 
  timeRange: { startDate?: string; endDate?: string }
) {
  try {
    console.log(`[SearchService] Searching entries with time range for userId: ${userId}`);
    console.log(`[SearchService] Time range: from ${timeRange.startDate || 'none'} to ${timeRange.endDate || 'none'}`);
    console.log(`[SearchService] Query embedding dimensions: ${queryEmbedding.length}`);
    
    // Enhanced debugging for date formats
    if (timeRange.startDate) {
      const startDate = new Date(timeRange.startDate);
      console.log(`[SearchService] Start date parsed: ${startDate.toISOString()}`);
    }
    
    if (timeRange.endDate) {
      const endDate = new Date(timeRange.endDate);
      console.log(`[SearchService] End date parsed: ${endDate.toISOString()}`);
    }
    
    // Ensure dates are in ISO format for the database
    const startDate = timeRange.startDate || null;
    const endDate = timeRange.endDate || null;
    
    console.log(`[SearchService] Calling match_journal_entries_with_date with parameters:`, {
      embedding_dimensions: queryEmbedding.length,
      match_threshold: 0.3,
      match_count: 10,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    });
    
    // Execute the database function with date parameters
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 10,
        user_id_filter: userId,
        start_date: startDate,
        end_date: endDate
      }
    );
    
    if (error) {
      console.error(`[SearchService] Error in time-filtered vector search: ${error.message}`);
      console.error(`[SearchService] Full error object:`, JSON.stringify(error));
      
      // Fallback to non-time-filtered search if time-filtered search fails
      console.log('[SearchService] Falling back to non-time-filtered vector search');
      return await searchEntriesWithVector(supabase, userId, queryEmbedding);
    }
    
    console.log(`[SearchService] Found ${data?.length || 0} entries with time-filtered vector similarity`);
    
    // Log entry dates for debugging
    if (data && data.length > 0) {
      const entryDates = data.map((entry: any) => ({
        id: entry.id,
        date: entry.created_at,
        similarity: entry.similarity,
        themes: entry.themes?.slice(0, 3) || []
      }));
      console.log("[SearchService] Time-filtered search results:", entryDates);
    } else {
      console.log("[SearchService] No entries found within time range, trying fallback");
      try {
        const fallback = await searchEntriesWithVector(supabase, userId, queryEmbedding);
        if (fallback && fallback.length > 0) {
          console.log(`[SearchService] Fallback vector search found ${fallback.length} entries`);
          return fallback;
        }
      } catch (fallbackErr) {
        console.warn("[SearchService] Fallback vector search failed:", fallbackErr);
      }
    }
    
    return data || [];
  } catch (error) {
    console.error('[SearchService] Error searching entries with time range:', error);
    throw error;
  }
}

/**
 * Search entries by specific month name using fixed vector functions
 */
export async function searchEntriesByMonth(
  supabase: any,
  userId: string,
  queryEmbedding: number[],
  monthName: string,
  year?: number
) {
  try {
    // Get current year if not provided
    const targetYear = year || new Date().getFullYear();
    console.log(`[SearchService] Searching entries for month: ${monthName} ${targetYear} for userId: ${userId}`);
    
    // Map month name to month index (0-based)
    const monthMap: Record<string, number> = {
      'january': 0, 'jan': 0,
      'february': 1, 'feb': 1,
      'march': 2, 'mar': 2,
      'april': 3, 'apr': 3,
      'may': 4,
      'june': 5, 'jun': 5,
      'july': 6, 'jul': 6,
      'august': 7, 'aug': 7,
      'september': 8, 'sep': 8, 'sept': 8,
      'october': 9, 'oct': 9,
      'november': 10, 'nov': 10,
      'december': 11, 'dec': 11
    };
    
    let monthIndex = -1;
    
    // First look for exact matches
    const normalizedMonthName = monthName.toLowerCase().trim();
    if (monthMap.hasOwnProperty(normalizedMonthName)) {
      monthIndex = monthMap[normalizedMonthName];
      console.log(`[SearchService] Found exact match for month name "${monthName}" -> index ${monthIndex}`);
    } else {
      // Try partial matches
      for (const [key, index] of Object.entries(monthMap)) {
        if (key.includes(normalizedMonthName) || normalizedMonthName.includes(key)) {
          console.log(`[SearchService] Found partial match for month "${monthName}" with "${key}"`);
          monthIndex = index;
          break;
        }
      }
    }
    
    if (monthIndex === -1) {
      console.error(`[SearchService] Invalid month name: ${monthName}`);
      return [];
    }
    
    // Create start and end dates for the month
    const startDate = new Date(targetYear, monthIndex, 1);
    const endDate = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59, 999);
    
    console.log(`[SearchService] Month date range: from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Use the existing time range function with these dates
    return await searchEntriesWithTimeRange(supabase, userId, queryEmbedding, { 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString() 
    });
  } catch (error) {
    console.error('[SearchService] Error searching entries by month:', error);
    throw error;
  }
}

/**
 * Search by themes using the fixed theme function
 */
export async function searchEntriesByThemes(
  supabase: any,
  userId: string,
  themeQueries: string[],
  timeRange?: { startDate?: string; endDate?: string }
) {
  try {
    console.log(`[SearchService] Searching by themes: ${themeQueries.join(', ')} for user: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_theme_array',
      {
        theme_queries: themeQueries,
        user_id_filter: userId,
        match_threshold: 0.3,
        match_count: 15,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error('[SearchService] Error in theme search:', error);
      throw error;
    }
    
    console.log(`[SearchService] Found ${data?.length || 0} entries matching themes`);
    return data || [];
  } catch (error) {
    console.error('[SearchService] Error searching entries by themes:', error);
    throw error;
  }
}

/**
 * Search by entities using the fixed entity function
 */
export async function searchEntriesByEntities(
  supabase: any,
  userId: string,
  entityQueries: string[],
  timeRange?: { startDate?: string; endDate?: string }
) {
  try {
    console.log(`[SearchService] Searching by entities: ${entityQueries.join(', ')} for user: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_entities',
      {
        entity_queries: entityQueries,
        user_id_filter: userId,
        match_threshold: 0.3,
        match_count: 15,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error('[SearchService] Error in entity search:', error);
      throw error;
    }
    
    console.log(`[SearchService] Found ${data?.length || 0} entries matching entities`);
    return data || [];
  } catch (error) {
    console.error('[SearchService] Error searching entries by entities:', error);
    throw error;
  }
}
