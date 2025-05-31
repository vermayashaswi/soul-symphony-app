
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share } from 'lucide-react';
import { ShareModal } from './ShareModal';
import { ShareableContent } from '@/services/shareService';

interface ShareButtonProps {
  content: ShareableContent;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  content,
  variant = 'outline',
  size = 'sm',
  children,
  className
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleShare}
        className={className}
      >
        <Share className="h-4 w-4 mr-2" />
        {children || 'Share'}
      </Button>

      <ShareModal
        content={content}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </>
  );
};
