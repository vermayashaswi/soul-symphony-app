
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
        return [];
      }

      if (!data || data.length === 0) {
        console.warn('[ThemeEmotionService] No active themes found');
        return [];
      }

      console.log(`[ThemeEmotionService] Successfully loaded ${data.length} active themes`);
      return data;
    } catch (err) {
      console.error('[ThemeEmotionService] Exception fetching themes:', err);
      return [];
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
        return [];
      }

      if (!data || data.length === 0) {
        console.warn('[ThemeEmotionService] No emotions found');
        return [];
      }

      console.log(`[ThemeEmotionService] Successfully loaded ${data.length} emotions`);
      return data;
    } catch (err) {
      console.error('[ThemeEmotionService] Exception fetching emotions:', err);
      return [];
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

  // Hardcoded fallbacks removed: master tables are the only source of truth
}

// Factory function for creating service instances
export function createThemeEmotionService(): ThemeEmotionService {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  
  return new ThemeEmotionService(supabaseUrl, supabaseServiceKey);
}
