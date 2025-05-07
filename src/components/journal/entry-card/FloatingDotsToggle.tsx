
import React from 'react';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FloatingDotsToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

export function FloatingDotsToggle({
  className,
  pressed = false,
  ...props
}: FloatingDotsToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 rounded-full transition-all",
        pressed ? "bg-muted" : "hover:bg-muted/50",
        className
      )}
      {...props}
    >
      <MoreVertical size={16} />
      <span className="sr-only">Toggle menu</span>
    </Button>
  );
}

export default FloatingDotsToggle;
