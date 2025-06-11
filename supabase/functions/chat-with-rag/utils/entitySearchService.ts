
/**
 * Theme search service for enhanced RAG pipeline with theme filtering and theme-emotion relationships
 */
export async function searchEntriesByThemes(
  supabase: any,
  userId: string,
  themes: string[],
  timeRange?: { startDate?: string; endDate?: string },
  optimizedParams?: any
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[themeSearchService] Optimized theme search for userId: ${userIdString}`);
    console.log(`[themeSearchService] Themes: ${themes.join(', ')}`);
    
    // PHASE 1 OPTIMIZATION: Check cache first
    const cacheKey = EnhancedCacheManager.generateQueryHash(
      `themes:${themes.join(',')}`,
      userIdString,
      { timeRange, type: 'theme_search' }
    );
    
    const cachedResults = EnhancedCacheManager.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      console.log(`[themeSearchService] Cache hit for theme search`);
      return cachedResults;
    }
    
    // Apply optimized parameters
    const maxResults = optimizedParams?.maxEntries || 15;
    const matchThreshold = optimizedParams?.skipThemeSearch ? 0.5 : 0.3;
    
    // Use the enhanced theme search function
    const { data, error } = await supabase.rpc(
      'match_journal_entries_by_theme_array',
      {
        theme_queries: themes,
        user_id_filter: userIdString,
        match_threshold: matchThreshold,
        match_count: maxResults,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null
      }
    );
    
    if (error) {
      console.error(`[themeSearchService] Error in theme search: ${error.message}`);
      throw error;
    }
    
    const results = data || [];
    console.log(`[themeSearchService] Theme search found ${results.length} entries`);
    
    // Cache the results
    EnhancedCacheManager.setCachedSearchResults(cacheKey, results);
    
    // Log theme matching details
    if (results.length > 0) {
      const themeDetails = results.slice(0, 3).map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        themes: entry.themes,
        theme_matches: entry.theme_matches,
        similarity: entry.similarity
      }));
      console.log("[themeSearchService] Theme search - Sample matching details:", themeDetails);
    }
    
    return results;
  } catch (error) {
    console.error('[themeSearchService] Error in theme search:', error);
    throw error;
  }
}

/**
 * NEW: Search entries by theme-emotion relationships using themeemotion column
 */
export async function searchEntriesByThemeEmotion(
  supabase: any,
  userId: string,
  themes: string[],
  emotions: string[],
  timeRange?: { startDate?: string; endDate?: string },
  optimizedParams?: any
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[themeSearchService] Optimized theme-emotion search for userId: ${userIdString}`);
    console.log(`[themeSearchService] Themes: ${themes.join(', ')}`);
    console.log(`[themeSearchService] Emotions: ${emotions.join(', ')}`);
    
    // Check cache first
    const cacheKey = EnhancedCacheManager.generateQueryHash(
      `theme_emotion:${themes.join(',')}:${emotions.join(',')}`,
      userIdString,
      { timeRange, type: 'theme_emotion_search' }
    );
    
    const cachedResults = EnhancedCacheManager.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      console.log(`[themeSearchService] Cache hit for theme-emotion search`);
      return cachedResults;
    }
    
    const maxResults = optimizedParams?.maxEntries || 15;
    
    // Build SQL query to search themeemotion column
    let query = supabase
      .from('Journal Entries')
      .select(`
        id,
        created_at,
        "refined text",
        "transcription text",
        master_themes,
        emotions,
        themeemotion,
        sentiment
      `)
      .eq('user_id', userIdString)
      .not('themeemotion', 'is', null);
    
    // Apply date filters
    if (timeRange?.startDate) {
      query = query.gte('created_at', timeRange.startDate);
    }
    if (timeRange?.endDate) {
      query = query.lte('created_at', timeRange.endDate);
    }
    
    query = query.order('created_at', { ascending: false }).limit(maxResults * 2);
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`[themeSearchService] Error in theme-emotion search: ${error.message}`);
      throw error;
    }
    
    // Filter and score entries based on theme-emotion relationships
    const scoredResults = (data || [])
      .map((entry: any) => {
        let themeEmotionScore = 0;
        let matchedRelationships = [];
        
        if (entry.themeemotion && typeof entry.themeemotion === 'object') {
          for (const theme of themes) {
            if (entry.themeemotion[theme]) {
              const themeEmotions = entry.themeemotion[theme];
              for (const emotion of emotions) {
                if (themeEmotions[emotion]) {
                  const strength = parseFloat(themeEmotions[emotion]) || 0;
                  themeEmotionScore += strength;
                  matchedRelationships.push({
                    theme,
                    emotion,
                    strength
                  });
                }
              }
            }
          }
        }
        
        return {
          ...entry,
          content: entry["refined text"] || entry["transcription text"] || "",
          theme_emotion_score: themeEmotionScore,
          theme_emotion_matches: matchedRelationships,
          relationship_strength: themeEmotionScore / Math.max(themes.length * emotions.length, 1)
        };
      })
      .filter(entry => entry.theme_emotion_score > 0)
      .sort((a, b) => b.theme_emotion_score - a.theme_emotion_score)
      .slice(0, maxResults);
    
    console.log(`[themeSearchService] Theme-emotion search found ${scoredResults.length} entries`);
    
    // Cache the results
    EnhancedCacheManager.setCachedSearchResults(cacheKey, scoredResults);
    
    // Log relationship analysis details
    if (scoredResults.length > 0) {
      const relationshipDetails = scoredResults.slice(0, 3).map((entry: any) => ({
        id: entry.id,
        date: new Date(entry.created_at).toLocaleDateString(),
        theme_emotion_matches: entry.theme_emotion_matches,
        relationship_strength: entry.relationship_strength
      }));
      console.log("[themeSearchService] Theme-emotion relationships:", relationshipDetails);
    }
    
    return scoredResults;
  } catch (error) {
    console.error('[themeSearchService] Error in theme-emotion search:', error);
    throw error;
  }
}

/**
 * Get theme statistics for user
 */
export async function getThemeStatistics(
  supabase: any,
  userId: string,
  timeRange?: { startDate?: string; endDate?: string },
  limitCount: number = 20
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[themeSearchService] Getting theme statistics for userId: ${userIdString}`);
    
    const { data, error } = await supabase.rpc(
      'get_theme_statistics',
      {
        user_id_filter: userIdString,
        start_date: timeRange?.startDate || null,
        end_date: timeRange?.endDate || null,
        limit_count: limitCount
      }
    );
    
    if (error) {
      console.error(`[themeSearchService] Error getting theme statistics: ${error.message}`);
      throw error;
    }
    
    console.log(`[themeSearchService] Found ${data?.length || 0} theme statistics`);
    return data || [];
  } catch (error) {
    console.error('[themeSearchService] Error getting theme statistics:', error);
    throw error;
  }
}

/**
 * NEW: Get theme-emotion relationship analytics using themeemotion column
 */
export async function getThemeEmotionAnalytics(
  supabase: any,
  userId: string,
  timeRange?: { startDate?: string; endDate?: string },
  limitCount: number = 10
) {
  try {
    const userIdString = typeof userId === 'string' ? userId : String(userId);
    console.log(`[themeSearchService] Getting theme-emotion analytics for userId: ${userIdString}`);
    
    // Get entries with theme-emotion relationships from themeemotion column
    let query = supabase
      .from('Journal Entries')
      .select('id, created_at, master_themes, emotions, themeemotion, sentiment')
      .eq('user_id', userIdString)
      .not('themeemotion', 'is', null);
    
    if (timeRange?.startDate) {
      query = query.gte('created_at', timeRange.startDate);
    }
    if (timeRange?.endDate) {
      query = query.lte('created_at', timeRange.endDate);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error(`[themeSearchService] Error getting theme-emotion analytics: ${error.message}`);
      throw error;
    }
    
    // Process theme-emotion relationships
    const analytics = {
      totalRelationships: 0,
      themeEmotionPairs: new Map(),
      strongestRelationships: [],
      emotionalPatterns: new Map(),
      timePatterns: []
    };
    
    data?.forEach((entry: any) => {
      if (entry.themeemotion) {
        Object.entries(entry.themeemotion).forEach(([theme, emotions]: [string, any]) => {
          Object.entries(emotions).forEach(([emotion, strength]: [string, any]) => {
            const strengthValue = typeof strength === 'number' ? strength : parseFloat(strength) || 0;
            const pairKey = `${theme}|${emotion}`;
            
            if (!analytics.themeEmotionPairs.has(pairKey)) {
              analytics.themeEmotionPairs.set(pairKey, {
                theme,
                emotion,
                occurrences: 0,
                avgStrength: 0,
                totalStrength: 0,
                entries: []
              });
            }
            
            const pair = analytics.themeEmotionPairs.get(pairKey);
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
    analytics.strongestRelationships = Array.from(analytics.themeEmotionPairs.values())
      .sort((a, b) => b.avgStrength - a.avgStrength)
      .slice(0, limitCount);
    
    console.log(`[themeSearchService] Found ${analytics.totalRelationships} theme-emotion relationships`);
    return analytics;
    
  } catch (error) {
    console.error('[themeSearchService] Error getting theme-emotion analytics:', error);
    throw error;
  }
}

/**
 * Enhanced search orchestrator with theme filtering and theme-emotion analysis
 */
export async function searchWithThemeStrategy(
  supabase: any,
  userId: string,
  queryEmbedding: number[],
  strategy: 'theme_focused' | 'theme_comprehensive' | 'theme_emotion_analysis',
  themes: string[],
  emotions?: string[],
  timeRange?: { startDate?: string; endDate?: string },
  maxEntries: number = 10,
  optimizedParams?: any
) {
  const userIdString = typeof userId === 'string' ? userId : String(userId);
  console.log(`[themeSearchService] Using optimized theme search strategy: ${strategy} for user: ${userIdString}`);
  
  try {
    let entries = [];
    
    switch (strategy) {
      case 'theme_emotion_analysis':
        if (emotions && emotions.length > 0) {
          entries = await searchEntriesByThemeEmotion(
            supabase, 
            userIdString, 
            themes, 
            emotions, 
            timeRange,
            optimizedParams
          );
        } else {
          entries = await searchEntriesByThemes(
            supabase, 
            userIdString, 
            themes, 
            timeRange,
            optimizedParams
          );
        }
        break;
        
      case 'theme_focused':
        entries = await searchEntriesByThemes(
          supabase, 
          userIdString, 
          themes, 
          timeRange,
          optimizedParams
        );
        break;
        
      case 'theme_comprehensive':
        const themeResults = await searchEntriesByThemes(
          supabase, 
          userIdString, 
          themes, 
          timeRange,
          optimizedParams
        );
        
        // Only supplement with semantic search if needed and not skipped for performance
        if (themeResults.length < maxEntries && !optimizedParams?.useVectorOnly) {
          const { searchEntriesWithVector } = await import('./searchService.ts');
          const semanticResults = await searchEntriesWithVector(supabase, userIdString, queryEmbedding);
          
          const combinedResults = [...themeResults];
          const existingIds = new Set(themeResults.map((entry: any) => entry.id));
          
          for (const semanticEntry of semanticResults) {
            if (!existingIds.has(semanticEntry.id) && combinedResults.length < maxEntries) {
              combinedResults.push(semanticEntry);
            }
          }
          
          entries = combinedResults;
        } else {
          entries = themeResults;
        }
        break;
        
      default:
        entries = await searchEntriesByThemes(
          supabase, 
          userIdString, 
          themes, 
          timeRange,
          optimizedParams
        );
        break;
    }
    
    // Apply max entries limit
    const limitedEntries = entries ? entries.slice(0, maxEntries) : [];
    console.log(`[themeSearchService] Retrieved ${limitedEntries.length} entries using optimized ${strategy} strategy`);
    
    return limitedEntries;
    
  } catch (error) {
    console.error(`[themeSearchService] Error in optimized ${strategy} search:`, error);
    throw error;
  }
}

// Backward compatibility exports (maintaining API)
export const searchEntriesByEntities = searchEntriesByThemes;
export const searchEntriesByEntityEmotion = searchEntriesByThemeEmotion;
export const getEntityStatistics = getThemeStatistics;
export const getTopEntitiesWithEntries = getThemeStatistics;
export const getEntityEmotionAnalytics = getThemeEmotionAnalytics;
export const getTopEntityEmotionRelationships = getThemeEmotionAnalytics;
export const searchWithEntityStrategy = searchWithThemeStrategy;
