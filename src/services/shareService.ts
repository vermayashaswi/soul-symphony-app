
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface ShareableContent {
  type: 'journal_entry' | 'mood_calendar' | 'emotion_chart' | 'achievement' | 'insight';
  title: string;
  content: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface ShareOptions {
  platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'copy_link';
  includeImage: boolean;
  customMessage?: string;
}

class ShareService {
  private readonly APP_URL = 'https://soulo.online';
  private readonly APP_NAME = 'SOuLO - Soul Symphony';

  async generateJournalEntryShare(entryId: number): Promise<ShareableContent> {
    try {
      const { data: entry, error } = await supabase
        .from('Journal Entries')
        .select('"refined text", "transcription text", created_at, sentiment, master_themes')
        .eq('id', entryId)
        .single();

      if (error || !entry) {
        throw new Error('Failed to fetch journal entry');
      }

      const date = format(new Date(entry.created_at), 'MMM dd, yyyy');
      const themes = Array.isArray(entry.master_themes) ? entry.master_themes.slice(0, 3) : [];
      const themesText = themes.length > 0 ? ` #${themes.join(' #')}` : '';

      return {
        type: 'journal_entry',
        title: `My Journal Entry - ${date}`,
        content: `Reflecting on my thoughts from ${date}. ${themesText}\n\nTrack your emotional journey with ${this.APP_NAME}`,
        metadata: {
          entryId,
          date: entry.created_at,
          themes
        }
      };
    } catch (error) {
      console.error('Error generating journal entry share:', error);
      throw error;
    }
  }

  async generateMoodCalendarShare(year: number, month: number): Promise<ShareableContent> {
    const monthName = format(new Date(year, month - 1), 'MMMM yyyy');
    
    return {
      type: 'mood_calendar',
      title: `My Mood Calendar - ${monthName}`,
      content: `Here's my emotional journey for ${monthName} 📅✨\n\nVisualizing emotions and patterns with ${this.APP_NAME}`,
      metadata: { year, month }
    };
  }

  async generateEmotionChartShare(emotions: Array<{name: string, score: number}>): Promise<ShareableContent> {
    const topEmotions = emotions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(e => e.name);

    return {
      type: 'emotion_chart',
      title: 'My Emotion Analysis',
      content: `My current emotional landscape: ${topEmotions.join(', ')} 🎭\n\nUnderstanding emotions with ${this.APP_NAME}`,
      metadata: { emotions }
    };
  }

  async generateAchievementShare(achievement: string, description: string): Promise<ShareableContent> {
    return {
      type: 'achievement',
      title: `Achievement Unlocked: ${achievement}`,
      content: `🏆 ${achievement}\n${description}\n\nCelebrating growth with ${this.APP_NAME}`,
      metadata: { achievement, description }
    };
  }

  async generateInsightShare(insight: string, category: string): Promise<ShareableContent> {
    return {
      type: 'insight',
      title: `Personal Insight: ${category}`,
      content: `💡 "${insight}"\n\nDiscovering patterns in my emotional journey with ${this.APP_NAME}`,
      metadata: { insight, category }
    };
  }

  generateShareUrl(content: ShareableContent, options: ShareOptions): string {
    const baseUrl = this.getBaseShareUrl(options.platform);
    const shareText = options.customMessage || content.content;
    const url = `${this.APP_URL}?ref=share`;

    switch (options.platform) {
      case 'twitter':
        return `${baseUrl}?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
      
      case 'facebook':
        return `${baseUrl}?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`;
      
      case 'linkedin':
        return `${baseUrl}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(content.title)}&summary=${encodeURIComponent(shareText)}`;
      
      case 'copy_link':
        return url;
      
      default:
        return url;
    }
  }

  private getBaseShareUrl(platform: ShareOptions['platform']): string {
    const urls = {
      twitter: 'https://twitter.com/intent/tweet',
      facebook: 'https://www.facebook.com/sharer/sharer.php',
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/',
      instagram: '', // Instagram doesn't support direct URL sharing
      copy_link: ''
    };

    return urls[platform];
  }

  async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  openShareUrl(url: string, platform: ShareOptions['platform']): void {
    if (platform === 'copy_link') return;

    const features = 'width=600,height=400,scrollbars=yes,resizable=yes';
    window.open(url, '_blank', features);
  }
}

export const shareService = new ShareService();
