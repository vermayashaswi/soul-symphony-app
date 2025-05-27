
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, Calendar, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useMentalHealthInsights } from '@/hooks/use-mental-health-insights';
import { useInsightsData } from '@/hooks/use-insights-data';
import SoulNet from '@/components/insights/SoulNet';
import MoodCalendar from '@/components/insights/MoodCalendar';
import EntityBubbles from '@/components/insights/EntityBubbles';
import EntityStrips from '@/components/insights/EntityStrips';
import ErrorBoundary from '@/components/insights/ErrorBoundary';
import { PremiumGuard } from '@/components/premium/PremiumGuard';

const Insights = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTimeframe, setSelectedTimeframe] = useState('7d');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    insights,
    refreshInsights
  } = useMentalHealthInsights(user?.id, { periodName: selectedTimeframe });

  const {
    insightsData,
    loading: dataLoading
  } = useInsightsData(user?.id, selectedTimeframe as any);

  // Extract data from insights object - using correct property names
  const emotionTrends = insights?.dominantEmotions || [];
  const topThemes = insights?.themes || [];
  const journalingSummary = {
    totalEntries: insights?.entryCount || 0,
    averageLength: null // Not available in current insights structure
  };
  const insightsLoading = insights?.loading || false;
  const insightsError = insights?.error || null;

  // Extract data from insightsData object - using correct property names
  const entities = insightsData?.allEntries || [];
  const emotionData = insightsData?.aggregatedEmotionData || {};
  const timeSeriesData = []; // Not available in current structure
  const dataError = null; // Since we're using the insightsData object directly

  useEffect(() => {
    if (insightsError || dataError) {
      toast({
        title: "Error loading insights",
        description: "Some insights may not be available. Please try again later.",
        variant: "destructive"
      });
    }
  }, [insightsError, dataError, toast]);

  const loading = insightsLoading || dataLoading;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Please sign in to view your insights.</p>
        </div>
      </div>
    );
  }

  return (
    <PremiumGuard 
      feature="Advanced Insights" 
      description="Deep insights and analytics about your mental wellness journey require a premium subscription."
    >
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              Insights
            </h1>
            <p className="text-muted-foreground mt-2">
              Discover patterns and trends in your mental wellness journey
            </p>
          </div>
        </div>

        {/* Timeframe Selection */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Time period:</span>
          {[
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
            { value: '90d', label: 'Last 90 days' },
            { value: '1y', label: 'Last year' }
          ].map(({ value, label }) => (
            <Button
              key={value}
              variant={selectedTimeframe === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTimeframe(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : (
          <ErrorBoundary>
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="emotions" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Emotions
                </TabsTrigger>
                <TabsTrigger value="connections" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Connections
                </TabsTrigger>
                <TabsTrigger value="themes" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Themes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Journal Entries</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {journalingSummary?.totalEntries || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {journalingSummary?.averageLength && 
                          `Avg ${Math.round(journalingSummary.averageLength)} words per entry`
                        }
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Dominant Emotion</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold capitalize">
                        {emotionTrends?.[0]?.name || 'N/A'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {emotionTrends?.[0]?.score && 
                          `${(emotionTrends[0].score * 100).toFixed(0)}% intensity`
                        }
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Top Theme</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {topThemes?.[0] || 'N/A'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Most common theme
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Advanced Toggle */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Advanced Visualizations</h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showAdvanced ? 'Hide' : 'Show'} Advanced
                  </Button>
                </div>

                {showAdvanced && (
                  <div className="space-y-6">
                    <EntityBubbles 
                      userId={user?.id} 
                      timeRange={selectedTimeframe as any}
                    />
                    <EntityStrips 
                      userId={user?.id} 
                      timeRange={selectedTimeframe as any}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="emotions" className="space-y-6">
                <MoodCalendar 
                  sentimentData={insightsData?.allEntries || []} 
                  timeRange={selectedTimeframe as any}
                />
              </TabsContent>

              <TabsContent value="connections" className="space-y-6">
                <SoulNet 
                  userId={user?.id}
                  timeRange={selectedTimeframe as any}
                />
              </TabsContent>

              <TabsContent value="themes" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Themes</CardTitle>
                    <CardDescription>
                      The most frequently mentioned topics in your journal entries
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topThemes && topThemes.length > 0 ? (
                      <div className="space-y-3">
                        {topThemes.map((theme, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{theme}</Badge>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              Theme {index + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No themes found for the selected time period.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ErrorBoundary>
        )}
      </div>
    </PremiumGuard>
  );
};

export default Insights;
