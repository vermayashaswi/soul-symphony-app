import { useState, useMemo, useEffect, useRef } from 'react';
import { Loader2 } from "lucide-react";
import { cn } from '@/lib/utils';
import { AggregatedEmotionData, TimeRange } from '@/hooks/use-insights-data';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { usePersistedState } from './insights/emotion-chart/hooks/usePersistedState';
import { ChevronHeader } from './insights/emotion-chart/components/ChevronHeader';
import { LineChart } from './insights/emotion-chart/components/LineChart';
import { BubbleChart } from './insights/emotion-chart/components/BubbleChart';
import { 
  filterAggregatedData, 
  processLineData, 
  processBubbleData, 
  getDominantEmotion 
} from './insights/emotion-chart/utils/dataProcessing';
import { 
  getNextDate, 
  getPreviousDate, 
  getPeriodLabel 
} from './insights/emotion-chart/utils/dateNavigation';

type ChartType = 'line' | 'bubble';

interface EmotionChartProps {
  className?: string;
  timeframe?: TimeRange;
  aggregatedData?: AggregatedEmotionData;
  currentDate?: Date;
  onTimeRangeNavigate?: (nextDate: Date) => void;
}

export function EmotionChart({ 
  className, 
  timeframe = 'week',
  aggregatedData,
  currentDate,
  onTimeRangeNavigate,
}: EmotionChartProps) {
  // Chart type (persisted per device!)
  const [chartType, setChartType] = usePersistedState<ChartType>('emotion-chart-type', 'bubble');
  const [bubbleKey, setBubbleKey] = useState(0); 
  const [visibleEmotions, setVisibleEmotions] = useState<string[]>([]);
  const [topRightPercentage, setTopRightPercentage] = useState<{
    emotion: string;
    percentage: number;
  } | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const initialRenderRef = useRef(true);

  // Chart period navigation: Use controlled prop from above or local state if not present
  const [internalDate, setInternalDate] = useState<Date>(new Date());
  const activeDate = typeof currentDate === 'object' ? currentDate : internalDate;

  useEffect(() => {
    // On timeframe change, always reset visibleEmotions
    setVisibleEmotions([]);
    if (!currentDate) setInternalDate(new Date());
  }, [timeframe]);

  // Chart types
  const chartTypes = [
    { id: 'line', label: 'Emotions' },
    { id: 'bubble', label: 'Life Areas' },
  ];
  
  // Navigation handlers with reduced loading state (since data is cached)
  const goToPrevious = () => {
    setIsNavigating(true);
    const newDate = getPreviousDate(timeframe, activeDate);
    if (onTimeRangeNavigate) onTimeRangeNavigate(newDate);
    else setInternalDate(newDate);
    
    // Shorter timeout since navigation should be instant with cached data
    setTimeout(() => setIsNavigating(false), 100);
  };
  
  const goToNext = () => {
    setIsNavigating(true);
    const newDate = getNextDate(timeframe, activeDate);
    if (onTimeRangeNavigate) onTimeRangeNavigate(newDate);
    else setInternalDate(newDate);
    
    // Shorter timeout since navigation should be instant with cached data
    setTimeout(() => setIsNavigating(false), 100);
  };
  
  // Reset period on timeframe change (keep currentDate prop precedence)
  useEffect(() => {
    if (!currentDate) setInternalDate(new Date());
  }, [timeframe, currentDate]);

  // FILTER/AGGREGATE: Only include data for the current period
  const filteredAggregatedData = useMemo(() => {
    return filterAggregatedData(aggregatedData || {}, timeframe, activeDate);
  }, [aggregatedData, timeframe, activeDate]);

  const bubbleData = useMemo(() => {
    return processBubbleData(filteredAggregatedData);
  }, [filteredAggregatedData]);
  
  useEffect(() => {
    if (initialRenderRef.current) {
      setBubbleKey(prev => prev + 1);
      setTimeout(() => {
        setBubbleKey(prev => prev + 1);
      }, 100);
      initialRenderRef.current = false;
    }
  }, []);
  
  useEffect(() => {
    setBubbleKey(prev => prev + 1);
  }, [chartType]);
  
  useEffect(() => {
    setBubbleKey(prev => prev + 1);
    setTimeout(() => {
      setBubbleKey(prev => prev + 1);
    }, 50);
  }, [timeframe, aggregatedData, bubbleData]);

  const handleEmotionClick = (emotion: string) => {
    if (bubbleData && emotion in bubbleData) {
      const total = Object.values(bubbleData).reduce((sum, value) => sum + value, 0);
      const percentage = (bubbleData[emotion] / total) * 100;
      
      setTopRightPercentage({
        emotion: emotion,
        percentage: Math.round(percentage * 10) / 10
      });
      
      setTimeout(() => {
        setTopRightPercentage(null);
      }, 2000);
    }
  };
  
  const handleEntityClick = (entity: string, sentiment: number) => {
    setTopRightPercentage({
      emotion: entity,
      percentage: Math.round(sentiment * 100) / 100
    });
    
    setTimeout(() => {
      setTopRightPercentage(null);
    }, 2000);
  };
  
  // Build lineData for this period only
  const lineData = useMemo(() => {
    return processLineData(filteredAggregatedData, visibleEmotions);
  }, [filteredAggregatedData, visibleEmotions]);

  const dominantEmotion = useMemo(() => {
    return getDominantEmotion(filteredAggregatedData);
  }, [filteredAggregatedData]);
  
  useEffect(() => {
    if (dominantEmotion && chartType === 'line' && visibleEmotions.length === 0) {
      setVisibleEmotions([dominantEmotion]);
    }
  }, [dominantEmotion, chartType, visibleEmotions.length]);

  const handleLegendClick = (emotion: string) => {
    setVisibleEmotions(prev => {
      if (prev.length === 1 && prev[0] === emotion) {
        return prev;
      }
      
      if (prev.includes(emotion)) {
        return prev.filter(e => e !== emotion);
      } 
      else {
        return [...prev, emotion];
      }
    });
  };

  const renderLineChart = () => {
    if (lineData.length === 0) {
      return (
        <div className="flex flex-col h-full">
          <ChevronHeader 
            isNavigating={isNavigating}
            onPrevious={goToPrevious}
            onNext={goToNext}
            periodLabel={getPeriodLabel(timeframe, activeDate)}
          />
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              <TranslatableText 
                text="No data available for this timeframe" 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            </p>
          </div>
        </div>
      );
    }

    const allEmotions = Object.keys(lineData[0])
      .filter(key => key !== 'day')
      .filter(key => lineData.some(point => point[key] !== null));

    if (allEmotions.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">
            <TranslatableText 
              text="No emotional data found" 
              forceTranslate={true}
              enableFontScaling={true}
              scalingContext="general"
            />
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <ChevronHeader 
          isNavigating={isNavigating}
          onPrevious={goToPrevious}
          onNext={goToNext}
          periodLabel={getPeriodLabel(timeframe, activeDate)}
        />
        <LineChart 
          data={lineData}
          visibleEmotions={visibleEmotions}
          onLegendClick={handleLegendClick}
        />
      </div>
    );
  };

  const renderBubbleChart = () => (
    <div className="w-full h-full flex flex-col">
      <ChevronHeader 
        isNavigating={isNavigating}
        onPrevious={goToPrevious}
        onNext={goToNext}
        periodLabel={getPeriodLabel(timeframe, activeDate)}
      />
      <BubbleChart 
        timeframe={timeframe}
        activeDate={activeDate}
        onEntityClick={handleEntityClick}
        topRightPercentage={topRightPercentage}
        bubbleKey={bubbleKey}
      />
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">
          <TranslatableText 
            text="TOP" 
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </h3>
        <div className="flex gap-2">
          {chartTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setChartType(type.id as ChartType)}
              className={cn(
                "px-3 py-1 rounded-full text-sm transition-all",
                chartType === type.id
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <TranslatableText 
                text={type.label} 
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="compact"
              />
            </button>
          ))}
        </div>
      </div>
      <div className="bg-card p-4 rounded-xl shadow-sm relative">
        {/* Reduced loading overlay since navigation should be instant */}
        {isNavigating && (
          <div className="absolute inset-0 bg-background/30 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {chartType === 'line' && renderLineChart()}
        {chartType === 'bubble' && renderBubbleChart()}
      </div>
    </div>
  );
}

export default EmotionChart;
