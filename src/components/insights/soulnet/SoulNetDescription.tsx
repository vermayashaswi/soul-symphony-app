
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export const SoulNetDescription = () => {
  const isMobile = useIsMobile();
  
  return (
    <>
      <div className={isMobile ? "p-4" : "px-4 pt-4"}>
        <h2 className="text-xl font-semibold mb-4">Soul-Net</h2>
        <p className="text-muted-foreground mb-4">
          Explore connections between life aspects and emotions in your journal.
        </p>
      </div>
      
      <div className="w-full text-center mt-2 px-4 md:px-8">
        <p className="text-xs text-muted-foreground">
          <b>Drag</b> to rotate • <b>Scroll</b> to zoom • <b>Tap/Click</b> a node to highlight connections
        </p>
      </div>
    </>
  );
};
