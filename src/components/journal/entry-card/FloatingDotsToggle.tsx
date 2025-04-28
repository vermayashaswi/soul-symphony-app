
import React from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface FloatingDotsToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function FloatingDotsToggle({ isExpanded, onToggle }: FloatingDotsToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
      aria-label={isExpanded ? "Show less text" : "Show more text"}
      title={isExpanded ? "Show less" : "Show more"}
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}

export default FloatingDotsToggle;
