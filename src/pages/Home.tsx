
import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  MessageSquare, 
  LineChart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useJournalEntries } from '@/hooks/use-journal-entries';
import JournalSummaryCard from '@/components/home/JournalSummaryCard';
import { TranslatableText } from '@/components/translation/TranslatableText';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entries, loading } = useJournalEntries();

  const recentEntries = entries?.slice(0, 3) || [];
  const totalEntries = entries?.length || 0;

  return (
    <div className="min-h-screen pb-20 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-3xl font-bold">
            <TranslatableText text="Welcome back" />
            {user?.user_metadata?.name && `, ${user.user_metadata.name}`}
          </h1>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card 
            className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
            onClick={() => navigate('/journal')}
          >
            <CardHeader className="text-center">
              <BookOpen className="h-8 w-8 mx-auto text-blue-600" />
              <CardTitle className="text-lg">
                <TranslatableText text="Journal" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-2xl font-bold">{totalEntries}</p>
              <p className="text-sm text-muted-foreground">
                <TranslatableText text="Total entries" />
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
            onClick={() => navigate('/chat')}
          >
            <CardHeader className="text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-green-600" />
              <CardTitle className="text-lg">
                <TranslatableText text="Chat with Ruh" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full">
                <TranslatableText text="Start conversation" />
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
            onClick={() => navigate('/insights')}
          >
            <CardHeader className="text-center">
              <LineChart className="h-8 w-8 mx-auto text-purple-600" />
              <CardTitle className="text-lg">
                <TranslatableText text="Insights" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" className="w-full">
                <TranslatableText text="View insights" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Journal Entries */}
        {recentEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <JournalSummaryCard />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Home;
