
import { useState, useCallback } from 'react';
import { shareService, ShareableContent } from '@/services/shareService';
import { imageGenerationService } from '@/services/imageGenerationService';
import { toast } from 'sonner';

export const useShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const generateJournalEntryShare = useCallback(async (entryId: number): Promise<ShareableContent> => {
    try {
      setIsSharing(true);
      return await shareService.generateJournalEntryShare(entryId);
    } catch (error) {
      console.error('Error generating journal entry share:', error);
      toast.error('Failed to generate shareable content');
      throw error;
    } finally {
      setIsSharing(false);
    }
  }, []);

  const generateMoodCalendarShare = useCallback(async (year: number, month: number): Promise<ShareableContent> => {
    try {
      setIsSharing(true);
      return await shareService.generateMoodCalendarShare(year, month);
    } catch (error) {
      console.error('Error generating mood calendar share:', error);
      toast.error('Failed to generate shareable content');
      throw error;
    } finally {
      setIsSharing(false);
    }
  }, []);

  const generateEmotionChartShare = useCallback(async (emotions: Array<{name: string, score: number}>): Promise<ShareableContent> => {
    try {
      setIsSharing(true);
      return await shareService.generateEmotionChartShare(emotions);
    } catch (error) {
      console.error('Error generating emotion chart share:', error);
      toast.error('Failed to generate shareable content');
      throw error;
    } finally {
      setIsSharing(false);
    }
  }, []);

  const generateAchievementShare = useCallback(async (achievement: string, description: string): Promise<ShareableContent> => {
    try {
      setIsSharing(true);
      return await shareService.generateAchievementShare(achievement, description);
    } catch (error) {
      console.error('Error generating achievement share:', error);
      toast.error('Failed to generate shareable content');
      throw error;
    } finally {
      setIsSharing(false);
    }
  }, []);

  const generateInsightShare = useCallback(async (insight: string, category: string): Promise<ShareableContent> => {
    try {
      setIsSharing(true);
      return await shareService.generateInsightShare(insight, category);
    } catch (error) {
      console.error('Error generating insight share:', error);
      toast.error('Failed to generate shareable content');
      throw error;
    } finally {
      setIsSharing(false);
    }
  }, []);

  const generateShareImage = useCallback(async (content: ShareableContent): Promise<string> => {
    try {
      let imageUrl: string;

      switch (content.type) {
        case 'mood_calendar':
          if (content.metadata?.year && content.metadata?.month) {
            imageUrl = await imageGenerationService.generateMoodCalendarImage(
              content.metadata.year,
              content.metadata.month,
              []
            );
          } else {
            throw new Error('Missing mood calendar data');
          }
          break;

        case 'emotion_chart':
          if (content.metadata?.emotions) {
            imageUrl = await imageGenerationService.generateEmotionChartImage(
              content.metadata.emotions
            );
          } else {
            throw new Error('Missing emotion data');
          }
          break;

        case 'achievement':
          if (content.metadata?.achievement && content.metadata?.description) {
            imageUrl = await imageGenerationService.generateAchievementImage(
              content.metadata.achievement,
              content.metadata.description
            );
          } else {
            throw new Error('Missing achievement data');
          }
          break;

        default:
          imageUrl = await imageGenerationService.generateShareImage({
            title: content.title,
            content: content.content,
            footer: 'SOuLO - Soul Symphony'
          });
          break;
      }

      setGeneratedImageUrl(imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Error generating share image:', error);
      toast.error('Failed to generate share image');
      throw error;
    }
  }, []);

  const quickShare = useCallback(async (content: ShareableContent, platform: 'twitter' | 'facebook' | 'linkedin' | 'copy_link') => {
    try {
      const shareUrl = shareService.generateShareUrl(content, { platform, includeImage: true });
      
      if (platform === 'copy_link') {
        const success = await shareService.copyToClipboard(shareUrl);
        if (success) {
          toast.success('Link copied to clipboard!');
        } else {
          toast.error('Failed to copy link');
        }
      } else {
        shareService.openShareUrl(shareUrl, platform);
        toast.success(`Opening ${platform} share dialog`);
      }
    } catch (error) {
      console.error('Error in quick share:', error);
      toast.error('Failed to share content');
    }
  }, []);

  return {
    isSharing,
    generatedImageUrl,
    generateJournalEntryShare,
    generateMoodCalendarShare,
    generateEmotionChartShare,
    generateAchievementShare,
    generateInsightShare,
    generateShareImage,
    quickShare
  };
};
