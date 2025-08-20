import React from 'react';
import { Badge } from '@/components/ui/badge';
import { LoaderIcon } from 'lucide-react';

interface ThreadStreamingIndicatorProps {
  isStreaming: boolean;
  hasActiveRequest: boolean;
  isCurrentThread?: boolean;
  className?: string;
}

export const ThreadStreamingIndicator: React.FC<ThreadStreamingIndicatorProps> = ({
  isStreaming,
  hasActiveRequest,
  isCurrentThread = false,
  className = ''
}) => {
  if (!isStreaming && !hasActiveRequest) return null;

  return (
    <div className={`inline-flex items-center ${className}`}>
      {isStreaming && (
        <Badge 
          variant={isCurrentThread ? "default" : "secondary"} 
          className="animate-pulse flex items-center gap-1 text-xs"
        >
          <LoaderIcon size={10} className="animate-spin" />
          {isCurrentThread ? "Streaming" : "Processing"}
        </Badge>
      )}
      {!isStreaming && hasActiveRequest && (
        <Badge 
          variant="outline" 
          className="flex items-center gap-1 text-xs"
        >
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          Ready
        </Badge>
      )}
    </div>
  );
};

export default ThreadStreamingIndicator;