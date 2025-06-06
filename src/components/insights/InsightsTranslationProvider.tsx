
import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { usePageTranslation } from '@/hooks/use-page-translation';
import { useAuth } from '@/contexts/AuthContext';
import { useInstantSoulNetData } from '@/hooks/useInstantSoulNetData';
import { TimeRange } from '@/hooks/use-insights-data';

interface InsightsTranslationContextType {
  isTranslating: boolean;
  progress: number;
  getTranslation: (text: string) => string | null;
  retryTranslation: () => void;
}

const InsightsTranslationContext = createContext<InsightsTranslationContextType | undefined>(undefined);

interface InsightsTranslationProviderProps {
  children: ReactNode;
  timeRange?: TimeRange;
}

// Common texts used throughout the Insights page
const INSIGHTS_PAGE_TEXTS = [
  'Insights',
  'Discover patterns in your emotional journey',
  'View:',
  'Day',
  'Week', 
  'Month',
  'Year',
  'Dominant Mood',
  'This week',
  'This month',
  'This year',
  'Today',
  'Appeared in most entries',
  'Not enough data',
  'Add more journal entries',
  'Biggest Change',
  'Increased significantly',
  'Decreased significantly',
  'Need more entries to compare',
  'Journal Activity',
  'entries',
  'days',
  'TOP',
  'Emotions',
  'Life Areas',
  'Positive',
  'Neutral', 
  'Negative',
  'Mood Trends',
  'Your sentiment changes over time',
  'Previous period',
  'Next period',
  'Chart view',
  'Calendar view',
  'No data available for this timeframe',
  'No journal data available',
  'Start recording journal entries to see your emotional insights.',
  'Go to Journal',
  'No emotional data found',
  '* Click on a legend item to focus on that emotion',
  'Soul-Net Visualization',
  'Explore the connections in your emotional landscape',
  'Sun',
  'Mon', 
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'
];

export const InsightsTranslationProvider: React.FC<InsightsTranslationProviderProps> = ({ 
  children, 
  timeRange = 'week' 
}) => {
  const { user } = useAuth();
  
  // Get SoulNet data to extract dynamic node labels
  const { graphData } = useInstantSoulNetData(user?.id, timeRange);
  
  // Extract all unique node labels from SoulNet data
  const dynamicNodeLabels = useMemo(() => {
    if (!graphData?.nodes) return [];
    
    const uniqueLabels = new Set<string>();
    graphData.nodes.forEach(node => {
      if (node?.id && typeof node.id === 'string' && node.id.trim()) {
        uniqueLabels.add(node.id.trim());
      }
    });
    
    const labels = Array.from(uniqueLabels);
    console.log('[InsightsTranslationProvider] Extracted dynamic node labels:', labels);
    return labels;
  }, [graphData?.nodes]);
  
  // Combine static texts with dynamic node labels for complete translation
  const allTextsToTranslate = useMemo(() => {
    const combined = [...INSIGHTS_PAGE_TEXTS, ...dynamicNodeLabels];
    console.log('[InsightsTranslationProvider] Total texts to translate:', combined.length, 'Static:', INSIGHTS_PAGE_TEXTS.length, 'Dynamic:', dynamicNodeLabels.length);
    return combined;
  }, [dynamicNodeLabels]);

  const pageTranslation = usePageTranslation({
    pageTexts: allTextsToTranslate,
    route: '/insights',
    enabled: true
  });

  const value: InsightsTranslationContextType = {
    isTranslating: pageTranslation.isTranslating,
    progress: pageTranslation.progress,
    getTranslation: pageTranslation.getTranslation,
    retryTranslation: pageTranslation.retryTranslation
  };

  return (
    <InsightsTranslationContext.Provider value={value}>
      {children}
    </InsightsTranslationContext.Provider>
  );
};

export const useInsightsTranslation = (): InsightsTranslationContextType => {
  const context = useContext(InsightsTranslationContext);
  if (context === undefined) {
    throw new Error('useInsightsTranslation must be used within an InsightsTranslationProvider');
  }
  return context;
};
