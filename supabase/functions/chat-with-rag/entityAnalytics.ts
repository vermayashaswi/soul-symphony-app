
// Entity analysis functions for the voice journaling RAG chatbot

// Function to search entries by entity
async function searchEntriesByEntity(supabase: any, userId: string, entityType: string | null = null, entityName: string | null = null, startDate = null, endDate = null, limit = 5) {
  try {
    console.log(`Searching for entries with entity. Type: ${entityType}, Name: ${entityName}`);
    
    // Define the basic query conditions
    let query = supabase
      .from('Journal Entries')
      .select('id, "refined text" as content, created_at, entities, emotions, sentiment_score')
      .eq('user_id', userId)
      .is('entities', 'not.null');
    
    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    // Execute the query
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error in entity search:", error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} entries with entities`);
    
    // Filter entries that have matching entities
    const filteredEntries = data?.filter((entry: any) => {
      if (!entry.entities) return false;
      
      try {
        const entities = Array.isArray(entry.entities) ? entry.entities : [];
        
        return entities.some((entity: any) => {
          // Match by entity type if provided
          const typeMatches = !entityType || 
                             entity.type?.toLowerCase().includes(entityType.toLowerCase());
          
          // Match by entity name if provided
          const nameMatches = !entityName || 
                             entity.name?.toLowerCase().includes(entityName.toLowerCase());
          
          // Return true if both conditions match or if only checking for one condition
          return typeMatches && nameMatches;
        });
      } catch (e) {
        console.error("Error parsing entities for entry", entry.id, e);
        return false;
      }
    }) || [];
    
    console.log(`Filtered to ${filteredEntries.length} entries with matching entities`);
    
    // Format the results
    return filteredEntries.slice(0, limit).map((entry: any) => ({
      id: entry.id,
      content: entry.content,
      created_at: entry.created_at,
      similarity: 0.85, // Arbitrary high score for direct entity matches
      type: 'entity_match',
      entities: entry.entities,
      emotions: entry.emotions,
      sentiment_score: entry.sentiment_score
    }));
  } catch (error) {
    console.error("Exception in searchEntriesByEntity:", error);
    throw error;
  }
}

// Function to analyze entity sentiments
async function analyzeEntitySentiment(supabase: any, userId: string, entityName: string, startDate = null, endDate = null) {
  try {
    // First, get entries that mention this entity
    const entries = await searchEntriesByEntity(
      supabase, 
      userId, 
      null, // no specific entity type
      entityName,
      startDate,
      endDate,
      20 // get more entries for better analysis
    );
    
    if (!entries || entries.length === 0) {
      return {
        found: false,
        error: `No entries found mentioning "${entityName}"`
      };
    }
    
    // Analyze sentiment toward this entity
    let totalSentiment = 0;
    let positiveMentions = 0;
    let negativeMentions = 0;
    let neutralMentions = 0;
    
    // Track most positive and negative mentions
    let mostPositiveMention = { score: -2, entry: null }; // -1 is the lowest possible score
    let mostNegativeMention = { score: 2, entry: null };  // 1 is the highest possible score
    
    entries.forEach((entry: any) => {
      // Check if we have a sentiment score
      if (entry.sentiment_score !== undefined && entry.sentiment_score !== null) {
        const score = parseFloat(entry.sentiment_score);
        totalSentiment += score;
        
        // Categorize the mention
        if (score > 0.25) {
          positiveMentions++;
          
          if (score > mostPositiveMention.score) {
            mostPositiveMention = { score, entry };
          }
        } else if (score < -0.25) {
          negativeMentions++;
          
          if (score < mostNegativeMention.score) {
            mostNegativeMention = { score, entry };
          }
        } else {
          neutralMentions++;
        }
      }
    });
    
    const averageSentiment = entries.length > 0 ? totalSentiment / entries.length : 0;
    
    return {
      found: true,
      entityName,
      mentionCount: entries.length,
      averageSentiment,
      sentimentDistribution: {
        positive: positiveMentions,
        neutral: neutralMentions,
        negative: negativeMentions
      },
      mostPositiveMention: mostPositiveMention.entry ? {
        date: mostPositiveMention.entry.created_at,
        score: mostPositiveMention.score,
        content: mostPositiveMention.entry.content
      } : null,
      mostNegativeMention: mostNegativeMention.entry ? {
        date: mostNegativeMention.entry.created_at,
        score: mostNegativeMention.score,
        content: mostNegativeMention.entry.content
      } : null
    };
  } catch (error) {
    console.error("Error analyzing entity sentiment:", error);
    return {
      found: false,
      error: error.message
    };
  }
}

// Find common entities in journal entries
async function findCommonEntities(supabase: any, userId: string, entityType: string | null = null, startDate = null, endDate = null, limit = 5) {
  try {
    // Build query for entries with entities
    let query = supabase
      .from('Journal Entries')
      .select('entities, created_at')
      .eq('user_id', userId)
      .is('entities', 'not.null');
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data: entries, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching entries with entities:", error);
      throw error;
    }
    
    if (!entries || entries.length === 0) {
      return {
        entities: [],
        entryCount: 0,
        error: 'No entries with entities found'
      };
    }
    
    // Count occurrences of each entity
    const entityCounts: Record<string, any> = {};
    
    entries.forEach((entry: any) => {
      if (entry.entities && Array.isArray(entry.entities)) {
        entry.entities.forEach((entity: any) => {
          // Only count entities of the specified type (if provided)
          if (!entityType || entity.type?.toLowerCase() === entityType.toLowerCase()) {
            const key = `${entity.name.toLowerCase()}|${entity.type || 'unknown'}`;
            
            if (!entityCounts[key]) {
              entityCounts[key] = {
                name: entity.name,
                type: entity.type || 'unknown',
                count: 0,
                dates: []
              };
            }
            
            entityCounts[key].count++;
            
            // Track dates this entity was mentioned (avoiding duplicates)
            if (!entityCounts[key].dates.includes(entry.created_at)) {
              entityCounts[key].dates.push(entry.created_at);
            }
          }
        });
      }
    });
    
    // Convert to array, sort by count, and limit
    const sortedEntities = Object.values(entityCounts)
      .sort((a, b) => b.count - a.count || b.dates.length - a.dates.length)
      .slice(0, limit)
      .map(entity => ({
        name: entity.name,
        type: entity.type,
        occurrences: entity.count,
        uniqueDates: entity.dates.length
      }));
    
    return {
      entities: sortedEntities,
      entryCount: entries.length
    };
  } catch (error) {
    console.error("Error finding common entities:", error);
    return {
      entities: [],
      entryCount: 0,
      error: error.message
    };
  }
}

// Export the functions
export {
  searchEntriesByEntity,
  analyzeEntitySentiment,
  findCommonEntities
};
