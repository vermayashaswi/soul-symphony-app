import React from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: React.ReactNode;
  disabled?: boolean;
  onRefresh?: () => Promise<void> | void;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ children, disabled, onRefresh }) => {
  const { containerRef, isPulling, isRefreshing, progress } = usePullToRefresh({ disabled, onRefresh });

  const translateY = isPulling || isRefreshing ? Math.round(progress * 40) : 0; // px

  return (
    <div ref={containerRef} className="min-h-screen" style={{ touchAction: 'pan-y' }}>
      <div
        aria-hidden
        className="fixed left-1/2 top-2 z-[60] -translate-x-1/2"
        style={{ transform: `translateY(${translateY}px)`, transition: isRefreshing ? 'transform 0.2s ease' : undefined }}
      >
        <div className="rounded-full px-3 py-1 text-xs bg-muted text-foreground shadow-sm border border-border">
          {isRefreshing ? 'Refreshing…' : isPulling ? `Pull to refresh ${Math.round(progress * 100)}%` : null}
        </div>
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
