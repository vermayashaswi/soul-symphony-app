
// Entity analytics for the chat-with-rag function

export async function findMentionedEntities(
  supabase: any, 
  userId: string, 
  entityQuery: string, 
  timeRange: { type: string | null, startDate: string | null, endDate: string | null }
) {
  try {
    const likePattern = `%${entityQuery}%`;
    
    // Add parameters for the query
    const params = [userId, likePattern];
    const timeParams: any[] = [];
    
    // Create time filter conditions
    let timeFilterClause = "";
    if (timeRange.startDate) {
      timeFilterClause += " AND created_at >= $3";
      timeParams.push(timeRange.startDate);
    }
    
    if (timeRange.endDate) {
      timeFilterClause += ` AND created_at <= $${3 + (timeRange.startDate ? 1 : 0)}`;
      timeParams.push(timeRange.endDate);
    }
    
    // Query for journal entries that mention the entity
    const { data: entries, error } = await supabase.rpc(
      'get_entries_by_entity',
      {
        entity_term: entityQuery,
        user_id_filter: userId,
        start_date: timeRange.startDate,
        end_date: timeRange.endDate,
        limit_count: 5
      }
    );
    
    if (error) {
      console.error("Entity search error:", error);
      
      // Fallback to simple text search if RPC fails
      const { data: fallbackEntries, error: fallbackError } = await supabase
        .from('Journal Entries')
        .select('id, "refined text", created_at')
        .eq('user_id', userId)
        .or(`"refined text".ilike.${likePattern},"transcription text".ilike.${likePattern}`)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (fallbackError) throw fallbackError;
      
      if (fallbackEntries) {
        return {
          entity: entityQuery,
          entries: fallbackEntries.map((entry: any) => ({
            id: entry.id,
            content: entry["refined text"],
            date: entry.created_at,
          }))
        };
      }
    }
    
    // Format entries for the response
    const formattedEntries = entries?.map((entry: any) => ({
      id: entry.id,
      content: entry.content,
      date: entry.created_at,
    })) || [];
    
    return {
      entity: entityQuery,
      entries: formattedEntries,
      count: formattedEntries.length
    };
  } catch (error) {
    console.error("Error in findMentionedEntities:", error);
    return { 
      entity: entityQuery, 
      entries: [],
      error: (error as Error).message
    };
  }
}
