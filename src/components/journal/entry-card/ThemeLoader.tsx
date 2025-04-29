
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface ThemeLoaderProps {
  entryId: number;
  initialThemes: string[];
  content?: string;
  isProcessing?: boolean;
  isNew?: boolean;
}

export function ThemeLoader({ entryId, initialThemes = [], content = '', isProcessing = false, isNew = false }: ThemeLoaderProps) {
  const [themes, setThemes] = useState<string[]>(initialThemes || []);
  const [loading, setLoading] = useState(isProcessing);

  useEffect(() => {
    if (initialThemes && initialThemes.length > 0) {
      setThemes(initialThemes);
      setLoading(false);
    }
  }, [initialThemes]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-20" />
        ))}
      </div>
    );
  }

  if (!themes || themes.length === 0) {
    return (
      <div className="text-xs text-muted-foreground mt-2">
        <TranslatableText 
          text="No themes available" 
          entryId={entryId}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {themes.map((theme, index) => (
        <Badge key={index} variant="outline" className="text-xs">
          <TranslatableText 
            text={theme}
            entryId={entryId}
          />
        </Badge>
      ))}
    </div>
  );
}

export default ThemeLoader;
