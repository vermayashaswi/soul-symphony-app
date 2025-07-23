
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Calendar, 
  BarChart3, 
  PieChart,
  Brain,
  Heart,
  Target,
  Sparkles
} from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { motion } from 'framer-motion';

const Insights = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { translate } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/app/auth');
      return;
    }
    
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, [user, navigate]);

  const mockData = {
    weeklyMoods: [
      { day: 'Mon', mood: 'happy', intensity: 8 },
      { day: 'Tue', mood: 'calm', intensity: 7 },
      { day: 'Wed', mood: 'anxious', intensity: 6 },
      { day: 'Thu', mood: 'excited', intensity: 9 },
      { day: 'Fri', mood: 'happy', intensity: 8 },
      { day: 'Sat', mood: 'calm', intensity: 7 },
      { day: 'Sun', mood: 'happy', intensity: 8 }
    ],
    topEmotions: [
      { emotion: 'Happy', count: 12, percentage: 35 },
      { emotion: 'Calm', count: 8, percentage: 25 },
      { emotion: 'Excited', count: 6, percentage: 18 },
      { emotion: 'Anxious', count: 4, percentage: 12 },
      { emotion: 'Sad', count: 3, percentage: 10 }
    ],
    journalStreak: 15,
    totalEntries: 47,
    averageMood: 7.2,
    insights: [
      "You tend to feel more positive on weekends",
      "Your journal entries are longer when you're feeling calm",
      "Morning journaling sessions show higher mood scores",
      "You've been consistent with your journaling practice this month"
    ]
  };

  const moodColors = {
    happy: 'bg-green-100 text-green-800',
    sad: 'bg-blue-100 text-blue-800',
    angry: 'bg-red-100 text-red-800',
    anxious: 'bg-yellow-100 text-yellow-800',
    calm: 'bg-purple-100 text-purple-800',
    excited: 'bg-orange-100 text-orange-800'
  };

  if (loading) {
    return (
      <div className="insights-container min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-container min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            <TranslatableText text="Insights" />
          </h1>
          <p className="text-muted-foreground">
            <TranslatableText text="Discover patterns in your journaling and mental wellness" />
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Journal Streak" />
                  </p>
                  <p className="text-2xl font-bold">{mockData.journalStreak}</p>
                </div>
                <Calendar className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Total Entries" />
                  </p>
                  <p className="text-2xl font-bold">{mockData.totalEntries}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="Average Mood" />
                  </p>
                  <p className="text-2xl font-bold">{mockData.averageMood}/10</p>
                </div>
                <Heart className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    <TranslatableText text="This Week" />
                  </p>
                  <p className="text-2xl font-bold">7</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">
              <TranslatableText text="Overview" />
            </TabsTrigger>
            <TabsTrigger value="emotions">
              <TranslatableText text="Emotions" />
            </TabsTrigger>
            <TabsTrigger value="patterns">
              <TranslatableText text="Patterns" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Weekly Mood Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <TranslatableText text="Weekly Mood Trend" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {mockData.weeklyMoods.map((day, index) => (
                    <motion.div
                      key={day.day}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="text-center"
                    >
                      <div className="text-sm font-medium mb-2">{day.day}</div>
                      <div 
                        className={`w-full h-20 rounded-lg flex items-center justify-center ${
                          moodColors[day.mood as keyof typeof moodColors] || 'bg-gray-100'
                        }`}
                      >
                        <span className="text-sm font-medium">{day.intensity}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize">
                        {day.mood}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  <TranslatableText text="AI Insights" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockData.insights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
                    >
                      <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                      <p className="text-sm">{insight}</p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emotions" className="space-y-6">
            {/* Top Emotions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  <TranslatableText text="Top Emotions" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockData.topEmotions.map((emotion, index) => (
                    <motion.div
                      key={emotion.emotion}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-primary rounded-full"></div>
                        <span className="font-medium">{emotion.emotion}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {emotion.count} times
                        </span>
                        <Badge variant="secondary">{emotion.percentage}%</Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            {/* Patterns Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  <TranslatableText text="Behavioral Patterns" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      <TranslatableText text="Pattern Analysis Coming Soon" />
                    </h3>
                    <p className="text-muted-foreground">
                      <TranslatableText text="We're working on advanced pattern recognition to help you understand your habits better" />
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Insights;
