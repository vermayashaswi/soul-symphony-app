import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface StreamingProgressProps {
  stage: string;
  message: string;
  progress?: number;
  estimatedCompletion?: number;
  data?: any;
}

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
  stage,
  message,
  progress = 0,
  estimatedCompletion,
  data
}) => {
  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'fast_track': return 'bg-green-500';
      case 'cache_hit': return 'bg-blue-500';
      case 'planning': return 'bg-yellow-500';
      case 'embedding': return 'bg-purple-500';
      case 'search_start': return 'bg-orange-500';
      case 'parallel_search': return 'bg-cyan-500';
      case 'response_generation': return 'bg-pink-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'fast_track': return '⚡';
      case 'cache_hit': return '💾';
      case 'planning': return '🧠';
      case 'embedding': return '🔮';
      case 'search_start': return '🔍';
      case 'parallel_search': return '⚡🔍';
      case 'response_generation': return '✍️';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const formatTimeEstimate = (timestamp: number) => {
    const remaining = Math.max(0, timestamp - Date.now());
    return `~${Math.ceil(remaining / 1000)}s`;
  };

  return (
    <motion.div 
      className="bg-background/95 backdrop-blur-sm border rounded-lg p-4 space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStageIcon(stage)}</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {stage.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        
        {estimatedCompletion && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatTimeEstimate(estimatedCompletion)}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-foreground">{message}</p>
        
        {progress > 0 && (
          <Progress value={progress} className="h-2" />
        )}
        
        {data && (
          <div className="text-xs text-muted-foreground space-y-1">
            {data.strategy && (
              <div>Strategy: <span className="font-medium">{data.strategy}</span></div>
            )}
            {data.searchMethod && (
              <div>Method: <span className="font-medium">{data.searchMethod}</span></div>
            )}
            {data.optimization && (
              <div>Optimization: <span className="font-medium">{data.optimization}</span></div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};