
// Shared utility for managing dynamic schema data across edge functions

// Dynamic allowed categories from generate-themes function
export const allowedCategories = [
  'work', 'relationships', 'family', 'health', 'goals', 'travel', 'creativity', 
  'learning', 'challenges', 'growth', 'personal development', 'spirituality', 
  'finances', 'hobbies', 'social life', 'career', 'education', 'fitness', 
  'mental health', 'self-care', 'adventure', 'reflection'
];

// Default emotions (fallback if database query fails)
export const defaultEmotions = [
  'happy', 'sad', 'anxious', 'excited', 'calm', 'stressed', 'angry', 'peaceful',
  'grateful', 'frustrated', 'hopeful', 'lonely', 'confident', 'worried', 'proud',
  'disappointed', 'content', 'overwhelmed', 'curious', 'inspired', 'jealous',
  'bored', 'surprised', 'disgusted', 'fearful', 'ashamed', 'guilty', 'embarrassed',
  'relieved', 'satisfied', 'nostalgic', 'melancholic', 'euphoric', 'irritated',
  'confused', 'determined', 'vulnerable', 'empowered', 'rejected', 'accepted',
  'motivated', 'discouraged', 'optimistic', 'pessimistic', 'energetic'
];

/**
 * Fetch dynamic emotions from the database
 */
export async function getDynamicEmotions(supabaseClient: any): Promise<string[]> {
  try {
    const { data: emotions, error } = await supabaseClient
      .from('emotions')
      .select('name')
      .order('name');

    if (error) {
      console.error('Error fetching emotions:', error);
      return defaultEmotions;
    }

    const emotionNames = emotions.map(emotion => emotion.name);
    console.log(`[Dynamic Schema] Loaded ${emotionNames.length} emotions from database`);
    return emotionNames;
  } catch (error) {
    console.error('Error in getDynamicEmotions:', error);
    return defaultEmotions;
  }
}

/**
 * Get dynamic themes (currently static from generate-themes function)
 */
export function getDynamicThemes(): string[] {
  return allowedCategories;
}

/**
 * Generate database schema context with dynamic data
 */
export async function generateDatabaseSchemaContext(supabaseClient?: any): Promise<string> {
  const dynamicEmotions = supabaseClient ? await getDynamicEmotions(supabaseClient) : defaultEmotions;
  const dynamicThemes = getDynamicThemes();

  return `
Available PostgreSQL Functions:
1. get_top_emotions_with_entries(user_id, start_date, end_date, limit_count) - Returns top emotions with sample entries
2. match_journal_entries_by_emotion(emotion_name, user_id, min_score, start_date, end_date, limit_count) - Find entries by specific emotion
3. match_journal_entries_fixed(query_embedding, match_threshold, match_count, user_id) - Vector similarity search
4. match_journal_entries_with_date(query_embedding, match_threshold, match_count, user_id, start_date, end_date) - Vector search with date filter

Table Structure:
- Journal Entries: id, user_id, created_at, "refined text", "transcription text", emotions (jsonb), master_themes (array), sentiment
- Emotions: Stored as jsonb with emotion names as keys and scores (0-1) as values
- Master Themes: Array of theme strings extracted from entries

Available Emotions (${dynamicEmotions.length}): ${dynamicEmotions.join(', ')}
Available Themes (${dynamicThemes.length}): ${dynamicThemes.join(', ')}
`;
}

/**
 * Create a standardized prompt template with dynamic schema
 */
export function createSchemaAwarePrompt(
  basePrompt: string, 
  dynamicEmotions: string[] = defaultEmotions, 
  dynamicThemes: string[] = allowedCategories
): string {
  return basePrompt
    .replace(/\{emotionCount\}/g, dynamicEmotions.length.toString())
    .replace(/\{availableEmotions\}/g, dynamicEmotions.join(', '))
    .replace(/\{themeCount\}/g, dynamicThemes.length.toString())
    .replace(/\{availableThemes\}/g, dynamicThemes.join(', '));
}

/**
 * Validate that emotions and themes in data match available schema
 */
export function validateSchemaData(
  data: any, 
  availableEmotions: string[] = defaultEmotions, 
  availableThemes: string[] = allowedCategories
): { validEmotions: any, validThemes: string[], removedEmotions: string[], removedThemes: string[] } {
  const result = {
    validEmotions: {},
    validThemes: [] as string[],
    removedEmotions: [] as string[],
    removedThemes: [] as string[]
  };

  // Validate emotions
  if (data.emotions && typeof data.emotions === 'object') {
    Object.entries(data.emotions).forEach(([emotion, score]) => {
      if (availableEmotions.includes(emotion)) {
        result.validEmotions[emotion] = score;
      } else {
        result.removedEmotions.push(emotion);
      }
    });
  }

  // Validate themes
  if (data.master_themes && Array.isArray(data.master_themes)) {
    data.master_themes.forEach((theme: string) => {
      if (availableThemes.includes(theme)) {
        result.validThemes.push(theme);
      } else {
        result.removedThemes.push(theme);
      }
    });
  }

  return result;
}
