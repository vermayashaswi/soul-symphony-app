
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ThemeLoaderProps {
  isLoading?: boolean;
  title?: string;
  onClick?: () => Promise<void> | void;
}

export function ThemeLoader({ isLoading = false, title = "Process", onClick }: ThemeLoaderProps) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 rounded-full p-0"
      onClick={onClick}
      disabled={isLoading}
      title={title}
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
    </Button>
  );
}

export default ThemeLoader;
