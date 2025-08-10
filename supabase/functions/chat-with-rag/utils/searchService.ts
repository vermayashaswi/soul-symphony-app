
// Enhanced search service with optimized array-based theme filtering and entity filtering
export async function searchEntriesWithVector(
  supabase: any,
  userId: string, 
  queryEmbedding: number[]
) {
  try {
    // Ensure userId is a string
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[chat-with-rag/searchService] Searching entries with vector similarity for userId: ${userIdString}`);
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.3, // Lowered threshold for better recall
        match_count: 10,
        user_id_filter: userIdString
      }
    );
    
    if (error) {
      console.error(`[chat-with-rag/searchService] Error in vector search: ${error.message}`);
      throw error;
    }
    
    console.log(`[chat-with-rag/searchService] Found ${data?.length || 0} entries with vector similarity`);
    
    // Add more detailed logging of results
    if (data && data.length > 0) {
      console.log("[chat-with-rag/searchService] Vector search results - entry dates:", 
        data.map((entry: any) => ({
          id: entry.id,
          date: new Date(entry.created_at).toISOString(),
          score: entry.similarity
        }))
      );
    }
    
    return data || [];
  } catch (error) {
    console.error('[chat-with-rag/searchService] Error searching entries with vector:', error);
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
    // Ensure userId is a string
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[chat-with-rag/searchService] Searching entries with time range for userId: ${userIdString}`);
    console.log(`[chat-with-rag/searchService] Time range: from ${timeRange.startDate || 'none'} to ${timeRange.endDate || 'none'}`);
    
    // Enhanced debugging for date formats
    if (timeRange.startDate) {
      const startDate = new Date(timeRange.startDate);
      console.log(`[chat-with-rag/searchService] Start date parsed: ${startDate.toISOString()} (${startDate.toString()})`);
    }
    
    if (timeRange.endDate) {
      const endDate = new Date(timeRange.endDate);
      console.log(`[chat-with-rag/searchService] End date parsed: ${endDate.toISOString()} (${endDate.toString()})`);
    }
    
    // Ensure dates are in ISO format for the database
    const startDate = timeRange.startDate || null;
    const endDate = timeRange.endDate || null;
    
    console.log(`[chat-with-rag/searchService] Sending time range to database: from ${startDate || 'none'} to ${endDate || 'none'}`);
    
    // Detailed logging of the actual parameters being sent to the database
    console.log("[chat-with-rag/searchService] Database function parameters:", {
      query_embedding: `[array with ${queryEmbedding.length} elements]`,
      match_threshold: 0.5,
      match_count: 10,
      user_id_filter: userIdString,
      start_date: startDate,
      end_date: endDate
    });
    
    // Execute the database function with date parameters
    const { data, error } = await supabase.rpc(
      'match_journal_entries_with_date',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 10,
        user_id_filter: userIdString,
        start_date: startDate,
        end_date: endDate
      }
    );
    
    if (error) {
      console.error(`[chat-with-rag/searchService] Error in time-filtered vector search: ${error.message}`);
      console.error(`[chat-with-rag/searchService] Full error object:`, JSON.stringify(error));
      throw error;
    }
    
    console.log(`[chat-with-rag/searchService] Found ${data?.length || 0} entries with time-filtered vector similarity`);
    
    // Log entry dates for debugging
    if (data && data.length > 0) {
      const entryDates = data.map((entry: any) => ({
        id: entry.id,
        date: entry.created_at,
        isoDate: new Date(entry.created_at).toISOString(),
        localDate: new Date(entry.created_at).toString(),
        score: entry.similarity
      }));
      console.log("[chat-with-rag/searchService] Time-filtered search - Entries found:", entryDates);
    } else {
      console.log("[chat-with-rag/searchService] No entries found within time range");
    }
    
    return data || [];
  } catch (error) {
    console.error('[chat-with-rag/searchService] Error searching entries with time range:', error);
    throw error;
  }
}

/**
 * Enhanced theme search using optimized array operations
 */
export async function searchEntriesByThemes(
  supabase: any,
  userId: string,
  themes: string[],
  timeRange?: { startDate?: string; endDate?: string }
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[chat-with-rag/searchService] Enhanced theme search for userId: ${userIdString}`);
    console.log(`[chat-with-rag/searchService] Themes: ${themes.join(', ')}`);
    
    // Use the new enhanced array-based theme search function
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_theme_array',
      {
        theme_queries: themes,
        user_id_filter: userIdString,
        match_threshold: 0.3,
        match_count: 15,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error(`[chat-with-rag/searchService] Error in enhanced theme search: ${error.message}`);
      throw error;
    }
    
    console.log(`[chat-with-rag/searchService] Enhanced theme search found ${data?.length || 0} entries`);
    
    // Log theme matching details
    if (data && data.length > 0) {
      const themeDetails = data.map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        themes: entry.themes,
        theme_matches: entry.theme_matches,
        similarity: entry.similarity
      }));
      console.log("[chat-with-rag/searchService] Enhanced theme search - Theme matching details:", themeDetails);
    }
    
    return data || [];
  } catch (error) {
    console.error('[chat-with-rag/searchService] Error in enhanced theme search:', error);
    throw error;
  }
}

/**
 * NEW: Enhanced entity search using array operations
 */
export async function searchEntriesByEntities(
  supabase: any,
  userId: string,
  entities: string[],
  timeRange?: { startDate?: string; endDate?: string }
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[chat-with-rag/searchService] Enhanced entity search for userId: ${userIdString}`);
    console.log(`[chat-with-rag/searchService] Entities: ${entities.join(', ')}`);
    
    // Use the new enhanced array-based entity search function
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_entities',
      {
        entity_queries: entities,
        user_id_filter: userIdString,
        match_threshold: 0.3,
        match_count: 15,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error(`[chat-with-rag/searchService] Error in enhanced entity search: ${error.message}`);
      throw error;
    }
    
    console.log(`[chat-with-rag/searchService] Enhanced entity search found ${data?.length || 0} entries`);
    
    // Log entity matching details
    if (data && data.length > 0) {
      const entityDetails = data.map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        entities: entry.entities,
        entity_matches: entry.entity_matches,
        similarity: entry.similarity
      }));
      console.log("[chat-with-rag/searchService] Enhanced entity search - Entity matching details:", entityDetails);
    }
    
    return data || [];
  } catch (error) {
    console.error('[chat-with-rag/searchService] Error in enhanced entity search:', error);
    throw error;
  }
}

/**
 * NEW: Enhanced entity-emotion search using specialized operations
 */
export async function searchEntriesByEntityEmotion(
  supabase: any,
  userId: string,
  entities: string[],
  emotions: string[],
  timeRange?: { startDate?: string; endDate?: string }
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[chat-with-rag/searchService] Entity-emotion relationship search for userId: ${userIdString}`);
    console.log(`[chat-with-rag/searchService] Entities: ${entities.join(', ')}, Emotions: ${emotions.join(', ')}`);
    
    // Use the new entity-emotion relationship search function
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_entity_emotion',
      {
        entity_queries: entities,
        emotion_queries: emotions,
        user_id_filter: userIdString,
        match_threshold: 0.3,
        match_count: 15,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error(`[chat-with-rag/searchService] Error in entity-emotion search: ${error.message}`);
      throw error;
    }
    
    console.log(`[chat-with-rag/searchService] Entity-emotion search found ${data?.length || 0} entries`);
    
    // Log relationship analysis details
    if (data && data.length > 0) {
      const relationshipDetails = data.map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        entity_emotion_matches: entry.entity_emotion_matches,
        relationship_strength: entry.relationship_strength,
        similarity: entry.similarity
      }));
      console.log("[chat-with-rag/searchService] Entity-emotion relationship analysis:", relationshipDetails);
    }
    
    return data || [];
  } catch (error) {
    console.error('[chat-with-rag/searchService] Error in entity-emotion search:', error);
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
    // Ensure userId is a string
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    
    // Get current year if not provided
    const targetYear = year || new Date().getFullYear();
    console.log(`[chat-with-rag/searchService] Searching entries for month: ${monthName} ${targetYear} for userId: ${userIdString}`);
    
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
      console.log(`[chat-with-rag/searchService] Found exact match for month name "${monthName}" -> index ${monthIndex}`);
    } else {
      // Try partial matches
      for (const [key, index] of Object.entries(monthMap)) {
        if (key.includes(normalizedMonthName) || normalizedMonthName.includes(key)) {
          console.log(`[chat-with-rag/searchService] Found partial match for month "${monthName}" with "${key}"`);
          monthIndex = index;
          break;
        }
      }
    }
    
    if (monthIndex === -1) {
      console.error(`[chat-with-rag/searchService] Invalid month name: ${monthName}`);
      return [];
    }
    
    // Create start and end dates for the month
    const startDate = new Date(targetYear, monthIndex, 1);
    const endDate = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59, 999);
    
    console.log(`[chat-with-rag/searchService] Month date range: from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`[chat-with-rag/searchService] Month JS dates: from ${startDate.toString()} to ${endDate.toString()}`);
    
    // Additional debugging for month detection
    console.log("[chat-with-rag/searchService] Month detection details:", {
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
    return await searchEntriesWithTimeRange(supabase, userIdString, queryEmbedding, { 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString() 
    });
  } catch (error) {
    console.error('[chat-with-rag/searchService] Error searching entries by month:', error);
    throw error;
  }
}

/**
 * Enhanced search orchestrator with improved theme and entity filtering
 */
export async function searchWithStrategy(
  supabase: any,
  userId: string,
  queryEmbedding: number[],
  strategy: 'vector' | 'hybrid' | 'comprehensive' | 'theme_focused' | 'entity_focused' | 'entity_emotion_analysis',
  timeRange?: { startDate?: string; endDate?: string },
  themes?: string[],
  entities?: string[],
  emotions?: string[],
  maxEntries: number = 10
) {
  // Ensure userId is a string
  const userIdString = typeof userId === 'string' ? userId : String(userId);
  console.log(`[searchService] Using enhanced search strategy: ${strategy} for user: ${userIdString}`);
  
  try {
    let entries = [];
    
    switch (strategy) {
      case 'entity_emotion_analysis':
        // NEW: Entity-emotion relationship analysis
        if (entities && entities.length > 0 && emotions && emotions.length > 0) {
          entries = await searchEntriesByEntityEmotion(supabase, userIdString, entities, emotions, timeRange);
        } else if (entities && entities.length > 0) {
          // Fallback to entity search
          entries = await searchEntriesByEntities(supabase, userIdString, entities, timeRange);
        } else {
          // Fallback to vector search
          entries = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
        }
        break;
        
      case 'entity_focused':
        // Entity-focused searches
        if (entities && entities.length > 0) {
          entries = await searchEntriesByEntities(supabase, userIdString, entities, timeRange);
        } else {
          // Fallback to vector search if no entities specified
          entries = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
        }
        break;
        
      case 'theme_focused':
        // Theme-focused searches
        if (themes && themes.length > 0) {
          entries = await searchEntriesByThemes(supabase, userIdString, themes, timeRange);
        } else {
          // Fallback to vector search if no themes specified
          entries = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
        }
        break;
        
      case 'comprehensive':
        // Use larger limits for comprehensive searches
        if (timeRange && (timeRange.startDate || timeRange.endDate)) {
          entries = await searchEntriesWithTimeRange(supabase, userIdString, queryEmbedding, timeRange);
        } else {
          entries = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
        }
        break;
        
      case 'hybrid':
        // Combine vector and time-based search
        if (timeRange && (timeRange.startDate || timeRange.endDate)) {
          entries = await searchEntriesWithTimeRange(supabase, userIdString, queryEmbedding, timeRange);
        } else {
          entries = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
        }
        break;
        
      case 'vector':
      default:
        // Standard vector search
        entries = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
        break;
    }
    
    // Apply max entries limit
    const limitedEntries = entries ? entries.slice(0, maxEntries) : [];
    console.log(`[searchService] Retrieved ${limitedEntries.length} entries using ${strategy} strategy`);
    
    return limitedEntries;
    
  } catch (error) {
    console.error(`[searchService] Error in ${strategy} search:`, error);
    throw error;
  }
}

/**
 * Validate search parameters
 */
export function validateSearchParams(userId: string, queryEmbedding: number[]): boolean {
  if (!userId || !queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    console.error('[searchService] Invalid search parameters');
    return false;
  }
  return true;
}
