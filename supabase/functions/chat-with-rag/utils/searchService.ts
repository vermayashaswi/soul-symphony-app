
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Search for journal entries using embedding vector similarity
 */
export async function searchEntriesWithVector(
  supabase: any,
  userId: string,
  queryEmbedding: number[],
  limit: number = 10,
  matchThreshold: number = 0.5
) {
  try {
    console.log(`Searching entries with vector similarity for user ${userId}`);
    
    const { data: entries, error } = await supabase.rpc('match_journal_entries', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: limit,
      user_id_filter: userId
    });
    
    if (error) {
      console.error('Error in vector search:', error);
      return [];
    }
    
    console.log(`Found ${entries?.length || 0} entries with vector similarity`);
    return entries || [];
  } catch (error) {
    console.error('Error in searchEntriesWithVector:', error);
    return [];
  }
}

/**
 * Search for journal entries using embedding vector similarity within a time range
 */
export async function searchEntriesWithTimeRange(
  supabase: any,
  userId: string,
  queryEmbedding: number[],
  dateRange: { startDate?: string; endDate?: string },
  limit: number = 10,
  matchThreshold: number = 0.5
) {
  try {
    console.log(`Searching entries with time range for userId: ${userId}`);
    console.log(`Time range: from ${dateRange.startDate || 'none'} to ${dateRange.endDate || 'none'}`);
    
    // Parse dates to ensure proper format
    let startDate = null;
    let endDate = null;
    
    if (dateRange.startDate) {
      startDate = new Date(dateRange.startDate);
      console.log(`Start date parsed: ${startDate.toISOString()} (${startDate.toString()})`);
    }
    
    if (dateRange.endDate) {
      endDate = new Date(dateRange.endDate);
      console.log(`End date parsed: ${endDate.toISOString()} (${endDate.toString()})`);
    }
    
    console.log(`Sending time range to database: from ${startDate?.toISOString() || 'none'} to ${endDate?.toISOString() || 'none'}`);
    
    // Detailed database function parameters for debugging
    console.log("Database function parameters:", {
      query_embedding: "[array with 1536 elements]",
      match_threshold: matchThreshold,
      match_count: limit,
      user_id_filter: userId,
      start_date: startDate?.toISOString() || null,
      end_date: endDate?.toISOString() || null
    });
    
    const { data: entries, error } = await supabase.rpc('match_journal_entries_with_date', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: limit,
      user_id_filter: userId,
      start_date: startDate?.toISOString() || null,
      end_date: endDate?.toISOString() || null
    });
    
    if (error) {
      console.error('Error in time-range search:', error);
      console.log('No entries found within time range');
      return [];
    }
    
    console.log(`Found ${entries?.length || 0} entries with time-filtered vector similarity`);
    return entries || [];
  } catch (error) {
    console.error('Error in searchEntriesWithTimeRange:', error);
    return [];
  }
}

/**
 * Search for journal entries by month
 */
export async function searchEntriesByMonth(
  supabase: any,
  userId: string,
  monthName: string,
  year?: number,
  limit: number = 10
) {
  try {
    console.log(`Searching entries for month: ${monthName} ${year || 'current year'}`);
    
    // Convert month name to month number (1-12)
    const currentYear = new Date().getFullYear();
    const targetYear = year || currentYear;
    
    const monthMap: { [key: string]: number } = {
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
    
    const month = monthMap[monthName.toLowerCase()];
    if (month === undefined) {
      console.error(`Invalid month name: ${monthName}`);
      return [];
    }
    
    // Create start and end dates for the month
    const startDate = new Date(targetYear, month, 1);
    const endDate = new Date(targetYear, month + 1, 0, 23, 59, 59, 999); // Last day of month
    
    console.log(`Month date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Query entries within the date range
    const { data: entries, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at, "transcription text", "refined text", master_themes, emotions')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit);
      
    if (error) {
      console.error('Error in month search:', error);
      return [];
    }
    
    // Process entries to add content field
    const processedEntries = entries.map((entry: any) => ({
      ...entry,
      content: entry["refined text"] || entry["transcription text"] || ""
    }));
    
    console.log(`Found ${processedEntries.length} entries for ${monthName} ${targetYear}`);
    return processedEntries || [];
  } catch (error) {
    console.error('Error in searchEntriesByMonth:', error);
    return [];
  }
}
