
import React from 'react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const EmptyState = () => {
  return (
    <div className={`
      bg-background rounded-xl p-8 text-center border min-h-[400px] flex items-center justify-center
    `}>
      <div>
        <h2 className="text-xl font-semibold mb-4">
          <TranslatableText text="No entity-emotion data available" />
        </h2>
        <p className="text-muted-foreground mb-6">
          <TranslatableText text="Continue journaling to see the connections between entities and emotions in your life." />
        </p>
        <Button onClick={() => window.location.href = '/journal'}>
          <TranslatableText text="Go to Journal" />
        </Button>
      </div>
    </div>
  );
};
