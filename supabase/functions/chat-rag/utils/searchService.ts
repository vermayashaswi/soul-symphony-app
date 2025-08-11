
// Standard vector search without time filtering
export async function searchEntriesWithVector(
  supabase: any,
  userId: string, 
  queryEmbedding: number[]
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
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
      console.error(`Error in vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with vector similarity`);
    
    // Add more detailed logging of results
    if (data && data.length > 0) {
      console.log("Vector search results - entry dates:", 
        data.map((entry: any) => ({
          id: entry.id,
          date: new Date(entry.created_at).toISOString(),
          score: entry.similarity
        }))
      );
    }
    
    return data || [];
  } catch (error) {
    console.error('Error searching entries with vector:', error);
    throw error;
  }
}

// Time-filtered vector search
export async function searchEntriesWithTimeRange(
  supabase: any,
  userId: string, 
  queryEmbedding: number[], 
  timeRange: { startDate?: string; endDate?: string }
) {
  try {
    console.log(`Searching entries with time range for userId: ${userId}`);
    console.log(`Time range: from ${timeRange.startDate || 'none'} to ${timeRange.endDate || 'none'}`);
    
    // Enhanced debugging for date formats
    if (timeRange.startDate) {
      const startDate = new Date(timeRange.startDate);
      console.log(`Start date parsed: ${startDate.toISOString()} (${startDate.toString()})`);
    }
    
    if (timeRange.endDate) {
      const endDate = new Date(timeRange.endDate);
      console.log(`End date parsed: ${endDate.toISOString()} (${endDate.toString()})`);
    }
    
    // Ensure dates are in ISO format for the database
    const startDate = timeRange.startDate || null;
    const endDate = timeRange.endDate || null;
    
    console.log(`Sending time range to database: from ${startDate || 'none'} to ${endDate || 'none'}`);
    
    // Detailed logging of the actual parameters being sent to the database
    console.log("Database function parameters:", {
      query_embedding: `[array with ${queryEmbedding.length} elements]`,
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
      console.error(`Error in time-filtered vector search: ${error.message}`);
      console.error(`Full error object:`, JSON.stringify(error));
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with time-filtered vector similarity`);
    
    // Log entry dates for debugging
    if (data && data.length > 0) {
      const entryDates = data.map((entry: any) => ({
        id: entry.id,
        date: entry.created_at,
        isoDate: new Date(entry.created_at).toISOString(),
        localDate: new Date(entry.created_at).toString(),
        score: entry.similarity
      }));
      console.log("Time-filtered search - Entries found:", entryDates);
    } else {
      console.log("No entries found within time range; falling back to non-time-filtered vector search");
      try {
        const fallback = await searchEntriesWithVector(supabase, userId, queryEmbedding);
        if (fallback && fallback.length > 0) {
          console.log(`Fallback vector search found ${fallback.length} entries`);
          return fallback;
        }
      } catch (fallbackErr) {
        console.warn("Fallback vector search failed:", fallbackErr);
      }
    }
    
    return data || [];
  } catch (error) {
    console.error('Error searching entries with time range:', error);
    throw error;
  }
}

/**
 * Search entries by specific month name
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
    console.log(`Searching entries for month: ${monthName} ${targetYear} for userId: ${userId}`);
    
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
      console.log(`Found exact match for month name "${monthName}" -> index ${monthIndex}`);
    } else {
      // Try partial matches
      for (const [key, index] of Object.entries(monthMap)) {
        if (key.includes(normalizedMonthName) || normalizedMonthName.includes(key)) {
          console.log(`Found partial match for month "${monthName}" with "${key}"`);
          monthIndex = index;
          break;
        }
      }
    }
    
    if (monthIndex === -1) {
      console.error(`Invalid month name: ${monthName}`);
      return [];
    }
    
    // Create start and end dates for the month
    const startDate = new Date(targetYear, monthIndex, 1);
    const endDate = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59, 999);
    
    console.log(`Month date range: from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Month JS dates: from ${startDate.toString()} to ${endDate.toString()}`);
    
    // Additional debugging for month detection
    console.log("Month detection details:", {
      providedMonthName: monthName,
      normalizedName: normalizedMonthName,
      detectedMonthIndex: monthIndex,
      resultingDateRange: {
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString()
      },
      month: monthIndex + 1,
      year: targetYear
    });
    
    // Use the existing time range function with these dates
    return await searchEntriesWithTimeRange(supabase, userId, queryEmbedding, { 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString() 
    });
  } catch (error) {
    console.error('Error searching entries by month:', error);
    throw error;
  }
}
