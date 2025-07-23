
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, Plus, BookOpen, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';
import { motion } from 'framer-motion';

interface JournalEntry {
  id: number;
  created_at: string;
  user_id: string;
  "transcription text"?: string;
  "refined text"?: string;
  master_themes?: string[];
  emotions?: any;
  sentiment?: string;
  audio_url?: string;
  duration?: number;
}

const Journal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { translate } = useTranslation();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMood, setFilterMood] = useState('all');

  useEffect(() => {
    if (!user) {
      navigate('/app/auth');
      return;
    }
    
    fetchEntries();
  }, [user, navigate]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('Journal Entries')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast({
        title: "Error loading entries",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = () => {
    navigate('/app/journal/new');
  };

  const handleEntryClick = (entryId: number) => {
    navigate(`/app/journal/${entryId}`);
  };

  const filteredEntries = entries.filter(entry => {
    const content = entry["refined text"] || entry["transcription text"] || '';
    const title = content.substring(0, 50) || 'Untitled Entry';
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMood = filterMood === 'all' || entry.sentiment === filterMood;
    return matchesSearch && matchesMood;
  });

  const sentimentColors = {
    positive: 'bg-green-100 text-green-800',
    negative: 'bg-red-100 text-red-800',
    neutral: 'bg-gray-100 text-gray-800',
    default: 'bg-gray-100 text-gray-800'
  };

  if (loading) {
    return (
      <div className="journal-container min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="journal-container min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              <TranslatableText text="Journal" />
            </h1>
            <p className="text-muted-foreground">
              <TranslatableText text="Your personal thoughts and reflections" />
            </p>
          </div>
          <Button onClick={handleCreateEntry} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <TranslatableText text="New Entry" />
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterMood}
              onChange={(e) => setFilterMood(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
            <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                <TranslatableText text="No entries found" />
              </h3>
              <p className="text-muted-foreground mb-4">
                <TranslatableText text="Start your journaling journey by creating your first entry" />
              </p>
              <Button onClick={handleCreateEntry}>
                <Plus className="h-4 w-4 mr-2" />
                <TranslatableText text="Create First Entry" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredEntries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleEntryClick(entry.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {(entry["refined text"] || entry["transcription text"] || 'Untitled Entry').substring(0, 50)}
                        {(entry["refined text"] || entry["transcription text"] || '').length > 50 && '...'}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {entry.sentiment && (
                          <Badge 
                            className={sentimentColors[entry.sentiment as keyof typeof sentimentColors] || sentimentColors.default}
                          >
                            {entry.sentiment}
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">
                      {(entry["refined text"] || entry["transcription text"] || '').substring(0, 150)}
                      {(entry["refined text"] || entry["transcription text"] || '').length > 150 && '...'}
                    </p>
                    {entry.master_themes && entry.master_themes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {entry.master_themes.map((theme, themeIndex) => (
                          <Badge key={themeIndex} variant="secondary" className="text-xs">
                            #{theme}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Journal;
