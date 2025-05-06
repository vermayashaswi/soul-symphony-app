
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MoodCalendarGrid from './MoodCalendarGrid';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface MoodCalendarProps {
  sentimentData: any[];
  isLoading?: boolean;
  filterLabel?: string;
  timeRange?: any;
}

const MoodCalendar: React.FC<MoodCalendarProps> = ({
  sentimentData,
  isLoading = false,
  filterLabel,
  timeRange
}) => {
  const [interval, setInterval] = useState('month');

  return (
    <Card id="emotion-chart" data-tutorial="emotion-chart">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold text-theme-color">
              <TranslatableText text="Mood Trends" />
            </CardTitle>
            <CardDescription>
              <TranslatableText text="Your sentiment changes over time" />
            </CardDescription>
          </div>
          <Tabs value={interval} onValueChange={setInterval} className="mt-0">
            <TabsList>
              <TabsTrigger value="week">
                <TranslatableText text="Week" />
              </TabsTrigger>
              <TabsTrigger value="month">
                <TranslatableText text="Month" />
              </TabsTrigger>
              <TabsTrigger value="year">
                <TranslatableText text="Year" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <MoodCalendarGrid 
          sentimentData={sentimentData} 
          interval={interval} 
          isLoading={isLoading}
          filterLabel={filterLabel}
        />
      </CardContent>
    </Card>
  );
};

export default MoodCalendar;
