
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { TimeRange } from '@/hooks/use-insights-data';

interface InsightCardProps {
  title: string;
  value: string;
  description: string;
  icon: string;
  globalDate: Date;
  timeRange: TimeRange;
}

const InsightCard: React.FC<InsightCardProps> = ({
  title,
  value,
  description,
  icon,
  globalDate,
  timeRange
}) => {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <TranslatableText 
            text={title}
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </CardTitle>
        <span className="text-2xl">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">
          <TranslatableText 
            text={value}
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          <TranslatableText 
            text={description}
            forceTranslate={true}
            enableFontScaling={true}
            scalingContext="general"
          />
        </p>
      </CardContent>
    </Card>
  );
};

export default InsightCard;
