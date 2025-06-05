
/**
 * Entity search service for enhanced RAG pipeline with entity filtering
 */
export async function searchEntriesByEntities(
  supabase: any,
  userId: string,
  entities: string[],
  timeRange?: { startDate?: string; endDate?: string }
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[entitySearchService] Entity search for userId: ${userIdString}`);
    console.log(`[entitySearchService] Entities: ${entities.join(', ')}`);
    
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
      console.error(`[entitySearchService] Error in entity search: ${error.message}`);
      throw error;
    }
    
    console.log(`[entitySearchService] Entity search found ${data?.length || 0} entries`);
    
    // Log entity matching details
    if (data && data.length > 0) {
      const entityDetails = data.map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        entities: entry.entities,
        entity_matches: entry.entity_matches,
        similarity: entry.similarity
      }));
      console.log("[entitySearchService] Entity search - Matching details:", entityDetails);
    }
    
    return data || [];
  } catch (error) {
    console.error('[entitySearchService] Error in entity search:', error);
    throw error;
  }
}

/**
 * NEW: Search entries by entity-emotion relationships
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
    console.log(`[entitySearchService] Entity-emotion relationship search for userId: ${userIdString}`);
    console.log(`[entitySearchService] Entities: ${entities.join(', ')}`);
    console.log(`[entitySearchService] Emotions: ${emotions.join(', ')}`);
    
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
      console.error(`[entitySearchService] Error in entity-emotion search: ${error.message}`);
      throw error;
    }
    
    console.log(`[entitySearchService] Entity-emotion search found ${data?.length || 0} entries`);
    
    // Log relationship analysis details
    if (data && data.length > 0) {
      const relationshipDetails = data.map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        entity_emotion_matches: entry.entity_emotion_matches,
        relationship_strength: entry.relationship_strength,
        similarity: entry.similarity
      }));
      console.log("[entitySearchService] Entity-emotion relationships:", relationshipDetails);
    }
    
    return data || [];
  } catch (error) {
    console.error('[entitySearchService] Error in entity-emotion search:', error);
    throw error;
  }
}

/**
 * Get entity statistics for user
 */
export async function getEntityStatistics(
  supabase: any,
  userId: string,
  timeRange?: { startDate?: string; endDate?: string },
  limitCount: number = 20
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[entitySearchService] Getting entity statistics for userId: ${userIdString}`);
    
    const { data, error } = await supabase.rpc(
      'get_entity_statistics',
      {
        user_id_filter: userIdString,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null,
        limit_count: limitCount
      }
    );
    
    if (error) {
      console.error(`[entitySearchService] Error getting entity statistics: ${error.message}`);
      throw error;
    }
    
    console.log(`[entitySearchService] Found ${data?.length || 0} entity statistics`);
    return data || [];
  } catch (error) {
    console.error('[entitySearchService] Error getting entity statistics:', error);
    throw error;
  }
}

/**
 * Get top entities with sample entries
 */
export async function getTopEntitiesWithEntries(
  supabase: any,
  userId: string,
  timeRange?: { startDate?: string; endDate?: string },
  limitCount: number = 5
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[entitySearchService] Getting top entities with entries for userId: ${userIdString}`);
    
    const { data, error } = await supabase.rpc(
      'get_top_entities_with_entries',
      {
        user_id_param: userIdString,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null,
        limit_count: limitCount
      }
    );
    
    if (error) {
      console.error(`[entitySearchService] Error getting top entities: ${error.message}`);
      throw error;
    }
    
    console.log(`[entitySearchService] Found ${data?.length || 0} top entities`);
    return data || [];
  } catch (error) {
    console.error('[entitySearchService] Error getting top entities:', error);
    throw error;
  }
}

/**
 * NEW: Get entity-emotion relationship analytics
 */
export async function getEntityEmotionAnalytics(
  supabase: any,
  userId: string,
  timeRange?: { startDate?: string; endDate?: string },
  limitCount: number = 10
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[entitySearchService] Getting entity-emotion analytics for userId: ${userIdString}`);
    
    // Get entries with entity-emotion relationships
    const { data, error } = await supabase
      .from('Journal Entries')
      .select('id, created_at, entities, emotions, entityemotion, sentiment')
      .eq('user_id', userIdString)
      .not('entityemotion', 'is', null)
      .gte('created_at', timeRange?.startDate || '1900-01-01')
      .lte('created_at', timeRange?.endDate || '2100-12-31')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error(`[entitySearchService] Error getting entity-emotion analytics: ${error.message}`);
      throw error;
    }
    
    // Process entity-emotion relationships
    const analytics = {
      totalRelationships: 0,
      entityEmotionPairs: new Map(),
      strongestRelationships: [],
      emotionalPatterns: new Map(),
      timePatterns: []
    };
    
    data?.forEach((entry: any) => {
      if (entry.entityemotion) {
        Object.entries(entry.entityemotion).forEach(([entity, emotions]: [string, any]) => {
          Object.entries(emotions).forEach(([emotion, strength]: [string, any]) => {
            const strengthValue = typeof strength === 'number' ? strength : parseFloat(strength) || 0;
            const pairKey = `${entity}|${emotion}`;
            
            if (!analytics.entityEmotionPairs.has(pairKey)) {
              analytics.entityEmotionPairs.set(pairKey, {
                entity,
                emotion,
                occurrences: 0,
                avgStrength: 0,
                totalStrength: 0,
                entries: []
              });
            }
            
            const pair = analytics.entityEmotionPairs.get(pairKey);
            pair.occurrences++;
            pair.totalStrength += strengthValue;
            pair.avgStrength = pair.totalStrength / pair.occurrences;
            pair.entries.push({
              id: entry.id,
              date: entry.created_at,
              strength: strengthValue
            });
            
            analytics.totalRelationships++;
          });
        });
      }
    });
    
    // Convert to arrays and sort
    analytics.strongestRelationships = Array.from(analytics.entityEmotionPairs.values())
      .sort((a, b) => b.avgStrength - a.avgStrength)
      .slice(0, limitCount);
    
    console.log(`[entitySearchService] Found ${analytics.totalRelationships} entity-emotion relationships`);
    return analytics;
    
  } catch (error) {
    console.error('[entitySearchService] Error getting entity-emotion analytics:', error);
    throw error;
  }
}

/**
 * NEW: Get top entity-emotion relationships using database function
 */
export async function getTopEntityEmotionRelationships(
  supabase: any,
  userId: string,
  timeRange?: { startDate?: string; endDate?: string },
  limitCount: number = 10
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[entitySearchService] Getting top entity-emotion relationships for userId: ${userIdString}`);
    
    const { data, error } = await supabase.rpc(
      'get_top_entity_emotion_relationships',
      {
        user_id_filter: userIdString,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null,
        limit_count: limitCount
      }
    );
    
    if (error) {
      console.error(`[entitySearchService] Error getting top entity-emotion relationships: ${error.message}`);
      throw error;
    }
    
    console.log(`[entitySearchService] Found ${data?.length || 0} top entity-emotion relationships`);
    return data || [];
  } catch (error) {
    console.error('[entitySearchService] Error getting top entity-emotion relationships:', error);
    throw error;
  }
}

/**
 * Enhanced search orchestrator with entity filtering
 */
export async function searchWithEntityStrategy(
  supabase: any,
  userId: string,
  queryEmbedding: number[],
  strategy: 'entity_focused' | 'entity_comprehensive' | 'entity_emotion_analysis',
  entities: string[],
  emotions?: string[],
  timeRange?: { startDate?: string; endDate?: string },
  maxEntries: number = 10
) {
  const userIdString = typeof userId === 'string' ? userId : String(userId);
  console.log(`[entitySearchService] Using enhanced entity search strategy: ${strategy} for user: ${userIdString}`);
  
  try {
    let entries = [];
    
    switch (strategy) {
      case 'entity_emotion_analysis':
        // NEW: Entity-emotion relationship analysis
        if (emotions && emotions.length > 0) {
          entries = await searchEntriesByEntityEmotion(supabase, userIdString, entities, emotions, timeRange);
        } else {
          // Fallback to regular entity search
          entries = await searchEntriesByEntities(supabase, userIdString, entities, timeRange);
        }
        break;
        
      case 'entity_focused':
        // Pure entity-based search
        entries = await searchEntriesByEntities(supabase, userIdString, entities, timeRange);
        break;
        
      case 'entity_comprehensive':
        // Combine entity search with semantic search for broader coverage
        const entityResults = await searchEntriesByEntities(supabase, userIdString, entities, timeRange);
        
        // If we don't get enough results from entity search, supplement with semantic search
        if (entityResults.length < maxEntries) {
          const { searchEntriesWithVector } = await import('./searchService.ts');
          const semanticResults = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
          
          // Combine and deduplicate results
          const combinedResults = [...entityResults];
          const existingIds = new Set(entityResults.map((entry: any) => entry.id));
          
          for (const semanticEntry of semanticResults) {
            if (!existingIds.has(semanticEntry.id) && combinedResults.length < maxEntries) {
              combinedResults.push(semanticEntry);
            }
          }
          
          entries = combinedResults;
        } else {
          entries = entityResults;
        }
        break;
        
      default:
        entries = await searchEntriesByEntities(supabase, userIdString, entities, timeRange);
        break;
    }
    
    // Apply max entries limit
    const limitedEntries = entries ? entries.slice(0, maxEntries) : [];
    console.log(`[entitySearchService] Retrieved ${limitedEntries.length} entries using ${strategy} strategy`);
    
    return limitedEntries;
    
  } catch (error) {
    console.error(`[entitySearchService] Error in ${strategy} search:`, error);
    throw error;
  }
}
