
// Enhanced emotion analysis functions for voice journaling RAG chatbot

// Helper function to normalize emotion names
function normalizeEmotionName(emotionInput: string, masterList?: any[]) {
  // If no master list is available, return the input as is
  if (!masterList || masterList.length === 0) {
    return emotionInput;
  }
  
  const input = emotionInput.toLowerCase();
  
  // Direct match with master list
  const directMatch = masterList.find(emotion => 
    emotion.name.toLowerCase() === input
  );
  
  if (directMatch) {
    return directMatch.name;
  }
  
  // Handle common aliases
  const emotionMap: Record<string, string> = {
    'happy': 'happiness',
    'sad': 'sadness',
    'angry': 'anger',
    'scared': 'fear',
    'afraid': 'fear',
    'anxious': 'anxiety',
    'nervous': 'anxiety',
    'joyful': 'joy',
    'content': 'contentment',
    'frustrated': 'frustration',
    'worried': 'worry',
    'excited': 'excitement'
  };
  
  if (emotionMap[input]) {
    const mappedMatch = masterList.find(emotion => 
      emotion.name.toLowerCase() === emotionMap[input]
    );
    
    if (mappedMatch) {
      return mappedMatch.name;
    }
  }
  
  // Fuzzy match - look for partial matches
  const partialMatch = masterList.find(emotion => 
    emotion.name.toLowerCase().includes(input) || 
    input.includes(emotion.name.toLowerCase())
  );
  
  if (partialMatch) {
    return partialMatch.name;
  }
  
  // Return original if no match found
  return emotionInput;
}

// Create a snippet with highlighted keyword
function createSnippetWithKeyword(text: string, keyword: string) {
  // Case insensitive search
  const regex = new RegExp(`(.{0,40})(${keyword})(.{0,40})`, 'i');
  const match = text.match(regex);
  
  if (!match) return text.substring(0, 80) + '...';
  
  return `...${match[1]}${match[2]}${match[3]}...`;
}

// Calculate average emotion score over a time period
async function calculateAverageEmotionScore(supabase: any, userId: string, emotionType = 'happiness', startDate = null, endDate = null) {
  try {
    // Build query for entries within the time range
    let query = supabase.from('Journal Entries')
      .select('emotions, created_at')
      .eq('user_id', userId);
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data: entries, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching entries for emotion calculation:", error);
      return {
        averageScore: null,
        entryCount: 0,
        error: error.message
      };
    }
    
    if (!entries || entries.length === 0) {
      return {
        averageScore: null,
        entryCount: 0,
        error: 'No entries found in the specified time range'
      };
    }
    
    // Calculate average emotion score
    let totalScore = 0;
    let validEntries = 0;
    let highestScore = { score: -1, entry: null };
    let lowestScore = { score: 2, entry: null }; // Score is between 0-1, so 2 is safely higher
    
    entries.forEach((entry: any) => {
      if (entry.emotions && typeof entry.emotions[emotionType] !== 'undefined') {
        const score = parseFloat(entry.emotions[emotionType]);
        totalScore += score;
        validEntries++;
        
        // Track highest and lowest scores
        if (score > highestScore.score) {
          highestScore = { score, entry };
        }
        
        if (score < lowestScore.score) {
          lowestScore = { score, entry };
        }
      }
    });
    
    const averageScore = validEntries > 0 ? totalScore / validEntries * 100 : null;
    
    return {
      averageScore: averageScore ? Math.round(averageScore) : null,
      entryCount: entries.length,
      validEntryCount: validEntries,
      highestScore: highestScore.score > 0 ? {
        score: highestScore.score * 100,
        date: highestScore.entry.created_at
      } : null,
      lowestScore: lowestScore.score < 2 ? {
        score: lowestScore.score * 100,
        date: lowestScore.entry.created_at
      } : null,
      emotionType
    };
  } catch (error) {
    console.error("Error calculating average emotion score:", error);
    return {
      averageScore: null,
      entryCount: 0,
      error: error.message
    };
  }
}

// Load master list of emotions for normalization
async function loadEmotionMasterList(supabase: any) {
  try {
    const { data, error } = await supabase
      .from('emotions')
      .select('name, category')
      .order('name');
    
    if (error) {
      console.error("Error loading emotion master list:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("Exception loading emotion master list:", error);
    return [];
  }
}

// Calculate top emotions over a time period
async function calculateTopEmotions(supabase: any, userId: string, startDate = null, endDate = null, limit = 3) {
  try {
    // Load master list of emotions for proper normalization
    const emotionMasterList = await loadEmotionMasterList(supabase);
    
    // Build query for entries within the time range
    let query = supabase.from('Journal Entries')
      .select('emotions, created_at, "refined text" as content, sentiment, sentiment_score, entities')
      .eq('user_id', userId);
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data: entries, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching entries for top emotions calculation:", error);
      return {
        topEmotions: [],
        entryCount: 0,
        error: error.message
      };
    }
    
    if (!entries || entries.length === 0) {
      return {
        topEmotions: [],
        entryCount: 0,
        error: 'No entries found in the specified time range'
      };
    }
    
    // Aggregate emotions across all entries
    const emotionScores: Record<string, any> = {};
    const emotionEntries: Record<string, any[]> = {}; // Track entries with highest scores for each emotion
    
    entries.forEach((entry: any) => {
      // Include sentiment score as "happiness" emotion
      if (typeof entry.sentiment_score !== 'undefined') {
        const normalizedEmotion = 'happiness';
        
        if (!emotionScores[normalizedEmotion]) {
          emotionScores[normalizedEmotion] = {
            total: 0,
            count: 0,
            highestScore: -1,
            highestScoreEntry: null
          };
        }
        
        // Convert Google's -1 to 1 scale to 0 to 1
        const numericScore = (parseFloat(entry.sentiment_score) + 1) / 2;
        emotionScores[normalizedEmotion].total += numericScore;
        emotionScores[normalizedEmotion].count += 1;
        
        // Track entry with highest score for this emotion
        if (numericScore > emotionScores[normalizedEmotion].highestScore) {
          emotionScores[normalizedEmotion].highestScore = numericScore;
          emotionScores[normalizedEmotion].highestScoreEntry = {
            date: entry.created_at,
            content: entry.content
          };
        }
        
        // Store entries with this emotion for context
        if (!emotionEntries[normalizedEmotion]) {
          emotionEntries[normalizedEmotion] = [];
        }
        emotionEntries[normalizedEmotion].push({
          date: entry.created_at,
          score: numericScore,
          content: entry.content
        });
      }
      
      // Process emotions from the emotions JSON field
      if (entry.emotions) {
        Object.entries(entry.emotions).forEach(([emotion, score]) => {
          // Normalize emotion name using master list
          const normalizedEmotion = normalizeEmotionName(emotion, emotionMasterList);
          
          if (!emotionScores[normalizedEmotion]) {
            emotionScores[normalizedEmotion] = {
              total: 0,
              count: 0,
              highestScore: -1,
              highestScoreEntry: null
            };
          }
          
          const numericScore = parseFloat(score as string);
          emotionScores[normalizedEmotion].total += numericScore;
          emotionScores[normalizedEmotion].count += 1;
          
          // Track entry with highest score for this emotion
          if (numericScore > emotionScores[normalizedEmotion].highestScore) {
            emotionScores[normalizedEmotion].highestScore = numericScore;
            emotionScores[normalizedEmotion].highestScoreEntry = {
              date: entry.created_at,
              content: entry.content
            };
          }
          
          // Store all entries with this emotion for context
          if (!emotionEntries[normalizedEmotion]) {
            emotionEntries[normalizedEmotion] = [];
          }
          emotionEntries[normalizedEmotion].push({
            date: entry.created_at,
            score: numericScore,
            content: entry.content
          });
        });
      }
    });
    
    // Calculate average for each emotion, sort, and limit
    const averagedEmotions = Object.entries(emotionScores)
      .map(([emotion, data]) => ({
        emotion,
        score: data.total / data.count,
        frequency: data.count,
        percentageOfEntries: (data.count / entries.length) * 100,
        highestOccurrence: data.highestScoreEntry,
        entries: emotionEntries[emotion]
          .sort((a, b) => b.score - a.score)
          .slice(0, 3) // Keep only top 3 entries for each emotion
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return {
      topEmotions: averagedEmotions,
      entryCount: entries.length,
      timeRange: {
        startDate,
        endDate
      }
    };
  } catch (error) {
    console.error("Error calculating top emotions:", error);
    return {
      topEmotions: [],
      entryCount: 0,
      error: error.message
    };
  }
}

// Find when a specific emotion was strongest
async function findStrongestEmotionOccurrence(supabase: any, userId: string, emotionType: string, startDate = null, endDate = null) {
  try {
    // Build query for entries within the time range
    let query = supabase.from('Journal Entries')
      .select('emotions, created_at, "refined text" as content')
      .eq('user_id', userId);
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data: entries, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching entries for emotion occurrence:", error);
      return {
        found: false,
        error: error.message
      };
    }
    
    if (!entries || entries.length === 0) {
      return {
        found: false,
        error: 'No entries found in the specified time range'
      };
    }
    
    // Find entry with highest score for the specified emotion
    let strongestOccurrence = null;
    let highestScore = -1;
    
    entries.forEach((entry: any) => {
      if (entry.emotions && typeof entry.emotions[emotionType] !== 'undefined') {
        const score = parseFloat(entry.emotions[emotionType]);
        if (score > highestScore) {
          highestScore = score;
          strongestOccurrence = {
            date: entry.created_at,
            score: score * 100, // Convert to percentage
            content: entry.content
          };
        }
      }
    });
    
    if (!strongestOccurrence) {
      return {
        found: false,
        error: `No entries found with emotion: ${emotionType}`
      };
    }
    
    return {
      found: true,
      emotion: emotionType,
      strongestOccurrence,
      entryCount: entries.length
    };
  } catch (error) {
    console.error("Error finding strongest emotion occurrence:", error);
    return {
      found: false,
      error: error.message
    };
  }
}

// Count occurrences of a keyword in journal entries
async function countKeywordOccurrences(supabase: any, userId: string, keyword: string, startDate = null, endDate = null) {
  try {
    if (!keyword) {
      return {
        count: 0,
        error: "No keyword provided"
      };
    }
    
    // Build query for entries within the time range
    let query = supabase.from('Journal Entries')
      .select('id, "refined text" as content, created_at')
      .eq('user_id', userId);
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    // Try to use ILIKE for case-insensitive search if available
    query = query.ilike('refined text', `%${keyword}%`);
    
    const { data: entries, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error counting keyword occurrences:", error);
      return {
        count: 0,
        error: error.message
      };
    }
    
    // For more accurate counting, count actual occurrences in each entry
    let totalOccurrences = 0;
    const entriesWithKeyword: any[] = [];
    
    entries.forEach((entry: any) => {
      // Case insensitive search
      const regex = new RegExp(keyword, 'gi');
      const matches = entry.content.match(regex);
      const occurrences = matches ? matches.length : 0;
      
      if (occurrences > 0) {
        totalOccurrences += occurrences;
        entriesWithKeyword.push({
          id: entry.id,
          date: entry.created_at,
          occurrences,
          snippet: createSnippetWithKeyword(entry.content, keyword)
        });
      }
    });
    
    return {
      keyword,
      count: totalOccurrences,
      entryCount: entriesWithKeyword.length,
      entries: entriesWithKeyword
    };
  } catch (error) {
    console.error("Error counting keyword occurrences:", error);
    return {
      count: 0,
      error: error.message
    };
  }
}

// Export the functions
export {
  calculateAverageEmotionScore,
  calculateTopEmotions,
  findStrongestEmotionOccurrence,
  countKeywordOccurrences,
  normalizeEmotionName,
  loadEmotionMasterList
};
