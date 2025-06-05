/**
 * Entity search service for enhanced RAG pipeline with entity filtering
 */
export async function searchEntriesByEntities(
  supabase: any,
  userId: string,
  entities: string[],
  timeRange?: { startDate?: string; endDate?: string },
  optimizedParams?: any
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[entitySearchService] Optimized entity search for userId: ${userIdString}`);
    console.log(`[entitySearchService] Entities: ${entities.join(', ')}`);
    
    // PHASE 1 OPTIMIZATION: Check cache first
    const cacheKey = EnhancedCacheManager.generateQueryHash(
      `entities:${entities.join(',')}`,
      userIdString,
      { timeRange, type: 'entity_search' }
    );
    
    const cachedResults = EnhancedCacheManager.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      console.log(`[entitySearchService] Cache hit for entity search`);
      return cachedResults;
    }
    
    // Apply optimized parameters
    const maxResults = optimizedParams?.maxEntries || 15;
    const matchThreshold = optimizedParams?.skipEntitySearch ? 0.5 : 0.3;
    
    // Use the new enhanced array-based entity search function
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_entities',
      {
        entity_queries: entities,
        user_id_filter: userIdString,
        match_threshold: matchThreshold,
        match_count: maxResults,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error(`[entitySearchService] Error in entity search: ${error.message}`);
      throw error;
    }
    
    const results = data || [];
    console.log(`[entitySearchService] Entity search found ${results.length} entries`);
    
    // Cache the results
    EnhancedCacheManager.setCachedSearchResults(cacheKey, results);
    
    // Log entity matching details
    if (results.length > 0) {
      const entityDetails = results.slice(0, 3).map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        entities: entry.entities,
        entity_matches: entry.entity_matches,
        similarity: entry.similarity
      }));
      console.log("[entitySearchService] Entity search - Sample matching details:", entityDetails);
    }
    
    return results;
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
  timeRange?: { startDate?: string; endDate?: string },
  optimizedParams?: any
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[entitySearchService] Optimized entity-emotion search for userId: ${userIdString}`);
    console.log(`[entitySearchService] Entities: ${entities.join(', ')}`);
    console.log(`[entitySearchService] Emotions: ${emotions.join(', ')}`);
    
    // Check cache first
    const cacheKey = EnhancedCacheManager.generateQueryHash(
      `entity_emotion:${entities.join(',')}:${emotions.join(',')}`,
      userIdString,
      { timeRange, type: 'entity_emotion_search' }
    );
    
    const cachedResults = EnhancedCacheManager.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      console.log(`[entitySearchService] Cache hit for entity-emotion search`);
      return cachedResults;
    }
    
    const maxResults = optimizedParams?.maxEntries || 15;
    const matchThreshold = optimizedParams?.skipEntitySearch ? 0.5 : 0.3;
    
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_entity_emotion',
      {
        entity_queries: entities,
        emotion_queries: emotions,
        user_id_filter: userIdString,
        match_threshold: matchThreshold,
        match_count: maxResults,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error(`[entitySearchService] Error in entity-emotion search: ${error.message}`);
      throw error;
    }
    
    const results = data || [];
    console.log(`[entitySearchService] Entity-emotion search found ${results.length} entries`);
    
    // Cache the results
    EnhancedCacheManager.setCachedSearchResults(cacheKey, results);
    
    // Log relationship analysis details
    if (results.length > 0) {
      const relationshipDetails = results.slice(0, 3).map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        entity_emotion_matches: entry.entity_emotion_matches,
        relationship_strength: entry.relationship_strength,
        similarity: entry.similarity
      }));
      console.log("[entitySearchService] Entity-emotion relationships:", relationshipDetails);
    }
    
    return results;
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
  maxEntries: number = 10,
  optimizedParams?: any
) {
  const userIdString = typeof userId === 'string' ? userId : String(userId);
  console.log(`[entitySearchService] Using optimized entity search strategy: ${strategy} for user: ${userIdString}`);
  
  try {
    let entries = [];
    
    switch (strategy) {
      case 'entity_emotion_analysis':
        if (emotions && emotions.length > 0) {
          entries = await searchEntriesByEntityEmotion(
            supabase, 
            userIdString, 
            entities, 
            emotions, 
            timeRange,
            optimizedParams
          );
        } else {
          entries = await searchEntriesByEntities(
            supabase, 
            userIdString, 
            entities, 
            timeRange,
            optimizedParams
          );
        }
        break;
        
      case 'entity_focused':
        entries = await searchEntriesByEntities(
          supabase, 
          userIdString, 
          entities, 
          timeRange,
          optimizedParams
        );
        break;
        
      case 'entity_comprehensive':
        const entityResults = await searchEntriesByEntities(
          supabase, 
          userIdString, 
          entities, 
          timeRange,
          optimizedParams
        );
        
        // Only supplement with semantic search if needed and not skipped for performance
        if (entityResults.length < maxEntries && !optimizedParams?.useVectorOnly) {
          const { searchEntriesWithVector } = await import('./searchService.ts');
          const semanticResults = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
          
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
        entries = await searchEntriesByEntities(
          supabase, 
          userIdString, 
          entities, 
          timeRange,
          optimizedParams
        );
        break;
    }
    
    // Apply max entries limit
    const limitedEntries = entries ? entries.slice(0, maxEntries) : [];
    console.log(`[entitySearchService] Retrieved ${limitedEntries.length} entries using optimized ${strategy} strategy`);
    
    return limitedEntries;
    
  } catch (error) {
    console.error(`[entitySearchService] Error in optimized ${strategy} search:`, error);
    throw error;
  }
}
