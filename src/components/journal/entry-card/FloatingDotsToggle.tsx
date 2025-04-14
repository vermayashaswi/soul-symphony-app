
import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FloatingDotsToggleProps {
  onClick: () => void;
}

export const FloatingDotsToggle: React.FC<FloatingDotsToggleProps> = ({ onClick }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
    
    // Add debugging to see if click is registered
    console.log("[FloatingDotsToggle] Toggle button clicked");
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className="h-8 w-8 rounded-full"
          aria-label="Toggle entry expansion"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Expand/Collapse</p>
      </TooltipContent>
    </Tooltip>
  );
};
