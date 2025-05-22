
// Standard vector search without time filtering
export async function searchEntriesWithVector(
  supabase: any,
  userId: string, 
  queryEmbedding: number[]
) {
  try {
    console.log(`Searching entries with vector similarity for userId: ${userId}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_fixed',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
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
    
    // Convert dates to UTC for database filtering
    const startDate = timeRange.startDate ? new Date(timeRange.startDate).toISOString() : null;
    const endDate = timeRange.endDate ? new Date(timeRange.endDate).toISOString() : null;
    
    console.log(`Converted time range for database query: from ${startDate || 'none'} to ${endDate || 'none'}`);
    
    // Detailed logging of the actual parameters being sent to the database
    console.log("Database function parameters:", {
      query_embedding: `[array with ${queryEmbedding.length} elements]`,
      match_threshold: 0.5,
      match_count: 10,
      user_id_filter: userId,
      start_date: startDate,
      end_date: endDate
    });
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userId,
        start_date: startDate,
        end_date: endDate
      }
    );
    
    if (error) {
      console.error(`Error in time-filtered vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with time-filtered vector similarity`);
    
    // Log entry dates for debugging
    if (data && data.length > 0) {
      const entryDates = data.map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toISOString(),
        score: entry.similarity
      }));
      console.log("Time-filtered search - Entry dates found:", entryDates);
    } else {
      console.log("No entries found within time range");
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
    for (const [key, index] of Object.entries(monthMap)) {
      if (monthName.toLowerCase() === key.toLowerCase()) {
        monthIndex = index;
        break;
      }
    }
    
    if (monthIndex === -1) {
      console.error(`Invalid month name: ${monthName}`);
      return [];
    }
    
    // Create start and end dates for the month
    const startDate = new Date(targetYear, monthIndex, 1).toISOString();
    const endDate = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59, 999).toISOString();
    
    console.log(`Month date range: from ${startDate} to ${endDate}`);
    
    // Additional debugging for month detection
    console.log("Month detection details:", {
      providedMonthName: monthName,
      normalizedName: monthName.toLowerCase(),
      detectedMonthIndex: monthIndex,
      resultingDateRange: {startDate, endDate}
    });
    
    // Use the existing time range function with these dates
    return await searchEntriesWithTimeRange(supabase, userId, queryEmbedding, { startDate, endDate });
  } catch (error) {
    console.error('Error searching entries by month:', error);
    throw error;
  }
}
