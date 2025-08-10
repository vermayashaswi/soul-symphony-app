
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export interface Theme {
  id: number;
  name: string;
  description: string | null;
  display_order: number | null;
  is_active: boolean;
}

export interface Emotion {
  id: number;
  name: string;
  description: string | null;
}

export class ThemeEmotionService {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getActiveThemes(): Promise<Theme[]> {
    try {
      const { data, error } = await this.supabase
        .from('themes')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[ThemeEmotionService] Error fetching themes:', error);
        return this.getFallbackThemes();
      }

      if (!data || data.length === 0) {
        console.warn('[ThemeEmotionService] No active themes found, using fallback');
        return this.getFallbackThemes();
      }

      console.log(`[ThemeEmotionService] Successfully loaded ${data.length} active themes`);
      return data;
    } catch (err) {
      console.error('[ThemeEmotionService] Exception fetching themes:', err);
      return this.getFallbackThemes();
    }
  }

  async getActiveEmotions(): Promise<Emotion[]> {
    try {
      const { data, error } = await this.supabase
        .from('emotions')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[ThemeEmotionService] Error fetching emotions:', error);
        return this.getFallbackEmotions();
      }

      if (!data || data.length === 0) {
        console.warn('[ThemeEmotionService] No emotions found, using fallback');
        return this.getFallbackEmotions();
      }

      console.log(`[ThemeEmotionService] Successfully loaded ${data.length} emotions`);
      return data;
    } catch (err) {
      console.error('[ThemeEmotionService] Exception fetching emotions:', err);
      return this.getFallbackEmotions();
    }
  }

  async getThemeNames(): Promise<string[]> {
    const themes = await this.getActiveThemes();
    return themes.map(theme => theme.name);
  }

  async getEmotionNames(): Promise<string[]> {
    const emotions = await this.getActiveEmotions();
    return emotions.map(emotion => emotion.name);
  }

  async getThemeEmotionContext(): Promise<{
    themes: string[];
    emotions: string[];
    themeDescriptions: Record<string, string>;
    emotionDescriptions: Record<string, string>;
  }> {
    const [themes, emotions] = await Promise.all([
      this.getActiveThemes(),
      this.getActiveEmotions()
    ]);

    const themeDescriptions: Record<string, string> = {};
    const emotionDescriptions: Record<string, string> = {};

    themes.forEach(theme => {
      if (theme.description) {
        themeDescriptions[theme.name] = theme.description;
      }
    });

    emotions.forEach(emotion => {
      if (emotion.description) {
        emotionDescriptions[emotion.name] = emotion.description;
      }
    });

    return {
      themes: themes.map(t => t.name),
      emotions: emotions.map(e => e.name),
      themeDescriptions,
      emotionDescriptions
    };
  }

  private getFallbackThemes(): Theme[] {
    return [
      { id: 1, name: 'Self & Identity', description: 'Personal growth, self-reflection, and identity exploration', display_order: 1, is_active: true },
      { id: 2, name: 'Body & Health', description: 'Physical health, fitness, body image, and medical concerns', display_order: 2, is_active: true },
      { id: 3, name: 'Mental Health', description: 'Emotional wellbeing, mental health challenges, and therapy', display_order: 3, is_active: true },
      { id: 4, name: 'Romantic Relationships', description: 'Dating, marriage, partnerships, and romantic connections', display_order: 4, is_active: true },
      { id: 5, name: 'Family', description: 'Family relationships, parenting, and family dynamics', display_order: 5, is_active: true },
      { id: 6, name: 'Friendships & Social Circle', description: 'Friendships, social connections, and community', display_order: 6, is_active: true },
      { id: 7, name: 'Career & Workplace', description: 'Work, career development, and professional relationships', display_order: 8, is_active: true },
      { id: 8, name: 'Money & Finances', description: 'Financial planning, money management, and economic concerns', display_order: 9, is_active: true },
      { id: 9, name: 'Creativity & Hobbies', description: 'Creative pursuits, hobbies, and artistic expression', display_order: 13, is_active: true },
      { id: 10, name: 'Purpose & Fulfillment', description: 'Life purpose, meaning, and personal fulfillment', display_order: 20, is_active: true }
    ];
  }

  private getFallbackEmotions(): Emotion[] {
    return [
      { id: 1, name: 'joy', description: 'A feeling of great pleasure and happiness' },
      { id: 2, name: 'sadness', description: 'A feeling of deep distress caused by loss, disappointment, or other misfortune' },
      { id: 3, name: 'anger', description: 'A strong feeling of annoyance, displeasure, or hostility' },
      { id: 4, name: 'fear', description: 'An unpleasant emotion caused by the belief that someone or something is dangerous' },
      { id: 5, name: 'surprise', description: 'A feeling of mild astonishment or shock caused by something unexpected' },
      { id: 6, name: 'trust', description: 'A firm belief in the integrity, ability, or character of a person or thing' },
      { id: 7, name: 'anticipation', description: 'The emotion of looking forward to something' },
      { id: 8, name: 'anxiety', description: 'A feeling of worry, nervousness, or unease' },
      { id: 9, name: 'gratitude', description: 'The quality of being thankful' },
      { id: 10, name: 'love', description: 'An intense feeling of deep affection' },
      { id: 11, name: 'excitement', description: 'A feeling of great enthusiasm and eagerness' },
      { id: 12, name: 'contentment', description: 'A state of happiness and satisfaction' },
      { id: 13, name: 'frustration', description: 'The feeling of being upset or annoyed as a result of being unable to change or achieve something' },
      { id: 14, name: 'hope', description: 'A feeling of expectation and desire for a certain thing to happen' },
      { id: 15, name: 'loneliness', description: 'Sadness because one has no friends or company' },
      { id: 16, name: 'confidence', description: 'The feeling or belief that one can rely on someone or something' }
    ];
  }
}

// Factory function for creating service instances
export function createThemeEmotionService(): ThemeEmotionService {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  return new ThemeEmotionService(supabaseUrl, supabaseServiceKey);
}
