
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Twitter, 
  Facebook, 
  Linkedin, 
  Instagram, 
  Copy, 
  Download,
  Loader2,
  Check
} from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { ShareableContent, ShareOptions, shareService } from '@/services/shareService';
import { imageGenerationService } from '@/services/imageGenerationService';
import { toast } from 'sonner';

interface ShareModalProps {
  content: ShareableContent;
  isOpen: boolean;
  onClose: () => void;
}

const SHARE_PLATFORMS = [
  { id: 'twitter' as const, name: 'Twitter', icon: Twitter, color: 'bg-blue-500' },
  { id: 'facebook' as const, name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
  { id: 'linkedin' as const, name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
  { id: 'instagram' as const, name: 'Instagram', icon: Instagram, color: 'bg-pink-500' },
];

export const ShareModal: React.FC<ShareModalProps> = ({
  content,
  isOpen,
  onClose
}) => {
  const [customMessage, setCustomMessage] = useState(content.content);
  const [includeImage, setIncludeImage] = useState(true);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCustomMessage(content.content);
      setGeneratedImageUrl(null);
      setCopiedLink(false);
    }
  }, [isOpen, content]);

  useEffect(() => {
    if (isOpen && includeImage && !generatedImageUrl && !isGeneratingImage) {
      generateShareImage();
    }
  }, [isOpen, includeImage, content]);

  const generateShareImage = async () => {
    if (isGeneratingImage) return;
    
    setIsGeneratingImage(true);
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
    } catch (error) {
      console.error('Failed to generate share image:', error);
      toast.error('Failed to generate share image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShare = async (platform: ShareOptions['platform']) => {
    const options: ShareOptions = {
      platform,
      includeImage,
      customMessage: customMessage !== content.content ? customMessage : undefined
    };

    try {
      if (platform === 'copy_link') {
        const shareUrl = shareService.generateShareUrl(content, options);
        const success = await shareService.copyToClipboard(shareUrl);
        
        if (success) {
          setCopiedLink(true);
          toast.success('Link copied to clipboard!');
          setTimeout(() => setCopiedLink(false), 2000);
        } else {
          toast.error('Failed to copy link');
        }
      } else {
        const shareUrl = shareService.generateShareUrl(content, options);
        shareService.openShareUrl(shareUrl, platform);
        toast.success(`Opening ${platform} share dialog`);
      }
    } catch (error) {
      console.error('Failed to share:', error);
      toast.error('Failed to share content');
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImageUrl) return;

    const link = document.createElement('a');
    link.download = `soulo-share-${content.type}-${Date.now()}.png`;
    link.href = generatedImageUrl;
    link.click();
    
    toast.success('Image downloaded successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TranslatableText text="Share Your Journey" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Content Preview */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{content.type.replace('_', ' ')}</Badge>
                  <h3 className="font-medium">{content.title}</h3>
                </div>
                
                {/* Image Preview */}
                {includeImage && (
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                    {isGeneratingImage ? (
                      <div className="flex items-center justify-center gap-2 py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-muted-foreground">
                          <TranslatableText text="Generating image..." />
                        </span>
                      </div>
                    ) : generatedImageUrl ? (
                      <div className="space-y-3">
                        <img 
                          src={generatedImageUrl} 
                          alt="Share preview" 
                          className="max-w-full h-auto rounded-lg shadow-sm mx-auto max-h-48 object-contain"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadImage}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          <TranslatableText text="Download Image" />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-8 text-muted-foreground">
                        <TranslatableText text="Image will be generated for sharing" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customization Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                <TranslatableText text="Include Image" />
              </label>
              <Switch
                checked={includeImage}
                onCheckedChange={setIncludeImage}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                <TranslatableText text="Custom Message" />
              </label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Customize your share message..."
                rows={4}
              />
            </div>
          </div>

          {/* Share Platforms */}
          <div className="space-y-4">
            <h4 className="font-medium">
              <TranslatableText text="Share On" />
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SHARE_PLATFORMS.map((platform) => {
                const Icon = platform.icon;
                return (
                  <Button
                    key={platform.id}
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => handleShare(platform.id)}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs">{platform.name}</span>
                  </Button>
                );
              })}
            </div>

            {/* Copy Link Button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleShare('copy_link')}
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <TranslatableText text="Link Copied!" />
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  <TranslatableText text="Copy Link" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
