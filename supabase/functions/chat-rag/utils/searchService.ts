
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
      const entryDates = data.map((entry: any) => new Date(entry.created_at).toISOString());
      console.log("Entry dates found:", entryDates);
    }
    
    return data || [];
  } catch (error) {
    console.error('Error searching entries with time range:', error);
    throw error;
  }
}
