
import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { usePageTranslation } from '@/hooks/use-page-translation';

interface InsightsTranslationContextType {
  isTranslating: boolean;
  progress: number;
  getTranslation: (text: string) => string | null;
  retryTranslation: () => void;
  getNodeLabelTranslation: (nodeId: string) => string;
}

const InsightsTranslationContext = createContext<InsightsTranslationContextType | undefined>(undefined);

interface InsightsTranslationProviderProps {
  children: ReactNode;
  nodeLabels?: string[]; // Dynamic node labels from SoulNet data
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
  nodeLabels = [] 
}) => {
  // Combine static UI texts with dynamic node labels for complete translation
  const allTexts = useMemo(() => {
    const uniqueNodeLabels = [...new Set(nodeLabels.filter(label => 
      label && 
      typeof label === 'string' && 
      label.trim() !== '' &&
      !INSIGHTS_PAGE_TEXTS.includes(label)
    ))];
    
    const combinedTexts = [...INSIGHTS_PAGE_TEXTS, ...uniqueNodeLabels];
    console.log(`[InsightsTranslationProvider] Combined texts for translation: ${combinedTexts.length} (UI: ${INSIGHTS_PAGE_TEXTS.length}, Nodes: ${uniqueNodeLabels.length})`);
    
    return combinedTexts;
  }, [nodeLabels]);

  const pageTranslation = usePageTranslation({
    pageTexts: allTexts,
    route: '/insights',
    enabled: true
  });

  // Get translation for node labels specifically
  const getNodeLabelTranslation = (nodeId: string): string => {
    if (!nodeId || typeof nodeId !== 'string') return nodeId || '';
    
    const translation = pageTranslation.getTranslation(nodeId);
    const result = translation || nodeId;
    
    console.log(`[InsightsTranslationProvider] Node label translation: "${nodeId}" -> "${result}"`);
    return result;
  };

  const value: InsightsTranslationContextType = {
    isTranslating: pageTranslation.isTranslating,
    progress: pageTranslation.progress,
    getTranslation: pageTranslation.getTranslation,
    retryTranslation: pageTranslation.retryTranslation,
    getNodeLabelTranslation
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
