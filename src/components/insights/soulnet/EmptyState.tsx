
import React from 'react';
import { Button } from '@/components/ui/button';

export const EmptyState = () => {
  return (
    <div className={`
      bg-background rounded-xl p-8 text-center border min-h-[400px] flex items-center justify-center
    `}>
      <div>
        <h2 className="text-xl font-semibold mb-4">No entity-emotion data available</h2>
        <p className="text-muted-foreground mb-6">
          Continue journaling to see the connections between entities and emotions in your life.
        </p>
        <Button onClick={() => window.location.href = '/journal'}>
          Go to Journal
        </Button>
      </div>
    </div>
  );
};
