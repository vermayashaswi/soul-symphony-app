
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share, Loader2 } from 'lucide-react';
import { ShareModal } from '@/components/share/ShareModal';
import { useShare } from '@/hooks/useShare';
import { ShareableContent } from '@/services/shareService';
import { toast } from 'sonner';

interface ShareEntryButtonProps {
  entryId: number;
  entryContent: string;
  entryDate: string;
  themes?: string[];
}

export const ShareEntryButton: React.FC<ShareEntryButtonProps> = ({
  entryId,
  entryContent,
  entryDate,
  themes = []
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareContent, setShareContent] = useState<ShareableContent | null>(null);
  const { isSharing, generateJournalEntryShare } = useShare();

  const handleShare = async () => {
    try {
      const content = await generateJournalEntryShare(entryId);
      setShareContent(content);
      setIsShareModalOpen(true);
    } catch (error) {
      console.error('Failed to prepare share content:', error);
      toast.error('Failed to prepare content for sharing');
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        disabled={isSharing}
        className="h-8 w-8 p-0"
      >
        {isSharing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share className="h-4 w-4" />
        )}
      </Button>

      {shareContent && (
        <ShareModal
          content={shareContent}
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setShareContent(null);
          }}
        />
      )}
    </>
  );
};
