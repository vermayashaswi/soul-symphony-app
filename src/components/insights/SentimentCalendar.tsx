
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TimeRange } from '@/hooks/use-insights-data';
import { format, parseISO, isValid } from 'date-fns';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarIcon } from 'lucide-react';

interface SentimentDataPoint {
  date: Date;
  sentiment: number;
}

interface SentimentCalendarProps {
  sentimentData: SentimentDataPoint[];
  timeRange: TimeRange;
}

const SentimentCalendar = ({ sentimentData, timeRange }: SentimentCalendarProps) => {
  // Process the data for the chart
  const processedData = React.useMemo(() => {
    if (!sentimentData || sentimentData.length === 0) return [];

    // Group by date and average sentiment for each day
    const dateMap = new Map<string, { total: number; count: number }>();
    
    sentimentData.forEach(point => {
      // Validate the date
      if (!point.date || !isValid(new Date(point.date))) {
        console.warn('Invalid date in sentiment data:', point);
        return;
      }

      // Validate the sentiment
      const sentimentValue = typeof point.sentiment === 'number' 
        ? point.sentiment 
        : typeof point.sentiment === 'string' 
          ? parseFloat(point.sentiment) 
          : null;
          
      if (sentimentValue === null || isNaN(sentimentValue)) {
        console.warn('Invalid sentiment value:', point.sentiment);
        return;
      }
      
      const dateKey = format(new Date(point.date), 'yyyy-MM-dd');
      
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { total: 0, count: 0 });
      }
      
      const existing = dateMap.get(dateKey)!;
      existing.total += sentimentValue;
      existing.count += 1;
    });
    
    // Convert to array of data points
    return Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      formattedDate: format(parseISO(date), 'MMM d'),
      sentiment: data.total / data.count,
      // Categorize the sentiment
      category: (data.total / data.count) >= 0.3 
        ? 'positive' 
        : (data.total / data.count) >= -0.1 
          ? 'neutral' 
          : 'negative'
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [sentimentData]);

  // Get color based on sentiment category
  const getSentimentColor = (category: string): string => {
    switch (category) {
      case 'positive': return '#4ade80'; // green-400
      case 'neutral': return '#facc15';  // yellow-400
      case 'negative': return '#ef4444'; // red-500
      default: return '#94a3b8';         // slate-400
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border p-2 rounded-md shadow-md">
          <p className="font-medium">{data.formattedDate}</p>
          <p className="text-sm">
            Sentiment: <span style={{ color: getSentimentColor(data.category) }}>
              {data.sentiment.toFixed(2)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg md:text-xl font-bold">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Sentiment Calendar</span>
            </div>
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent>
        {processedData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center">
            <p className="text-muted-foreground">No sentiment data available for this period</p>
          </div>
        ) : (
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                <XAxis 
                  dataKey="formattedDate" 
                  scale="point" 
                  padding={{ left: 10, right: 10 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  domain={[-1, 1]} 
                  tickCount={5} 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="sentiment" 
                  radius={[4, 4, 0, 0]}
                  barSize={timeRange === 'year' ? 4 : 20}
                  fill="#8b5cf6"
                  name="Sentiment"
                  fillOpacity={0.8}
                  strokeWidth={1}
                  stroke="#8b5cf6"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SentimentCalendar;
