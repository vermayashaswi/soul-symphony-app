import React from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: React.ReactNode;
  disabled?: boolean;
  onRefresh?: () => Promise<void> | void;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ children, disabled, onRefresh }) => {
  const { containerRef } = usePullToRefresh({ disabled, onRefresh });

  

  return (
    <div ref={containerRef} className="min-h-screen" style={{ touchAction: 'pan-y' }}>
      {children}
    </div>
  );
};

export default PullToRefresh;
