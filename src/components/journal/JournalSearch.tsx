
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { JournalEntry } from '@/types/journal';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useDebounce } from 'use-debounce';

interface JournalSearchProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onSearchResults: (filteredEntries: JournalEntry[]) => void;
}

const JournalSearch: React.FC<JournalSearchProps> = ({
  entries,
  onSelectEntry,
  onSearchResults
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  // Extract all unique themes from entries
  const allThemes = useMemo(() => {
    const themes = new Set<string>();
    entries.forEach(entry => {
      if (entry.master_themes) {
        entry.master_themes.forEach(theme => themes.add(theme));
      }
    });
    return Array.from(themes).sort();
  }, [entries]);

  // Extract all unique emotions from entries
  const allEmotions = useMemo(() => {
    const emotions = new Set<string>();
    entries.forEach(entry => {
      if (entry.emotions) {
        Object.keys(entry.emotions).forEach(emotion => emotions.add(emotion));
      }
    });
    return Array.from(emotions).sort();
  }, [entries]);

  // Filter entries based on search criteria
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    // Text search
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.content.toLowerCase().includes(query) ||
        (entry.master_themes && entry.master_themes.some(theme => 
          theme.toLowerCase().includes(query)
        )) ||
        (entry.sentiment && entry.sentiment.toLowerCase().includes(query))
      );
    }

    // Theme filtering
    if (selectedThemes.length > 0) {
      filtered = filtered.filter(entry => 
        entry.master_themes && entry.master_themes.some(theme => 
          selectedThemes.includes(theme)
        )
      );
    }

    // Emotion filtering
    if (selectedEmotions.length > 0) {
      filtered = filtered.filter(entry => 
        entry.emotions && Object.keys(entry.emotions).some(emotion => 
          selectedEmotions.includes(emotion)
        )
      );
    }

    // Date filtering
    if (dateRange.start) {
      filtered = filtered.filter(entry => 
        new Date(entry.created_at) >= new Date(dateRange.start)
      );
    }
    if (dateRange.end) {
      filtered = filtered.filter(entry => 
        new Date(entry.created_at) <= new Date(dateRange.end + 'T23:59:59')
      );
    }

    return filtered;
  }, [entries, debouncedSearchQuery, selectedThemes, selectedEmotions, dateRange]);

  // Update parent component with filtered results
  useEffect(() => {
    onSearchResults(filteredEntries);
  }, [filteredEntries, onSearchResults]);

  const handleThemeToggle = (theme: string) => {
    setSelectedThemes(prev => 
      prev.includes(theme) 
        ? prev.filter(t => t !== theme)
        : [...prev, theme]
    );
  };

  const handleEmotionToggle = (emotion: string) => {
    setSelectedEmotions(prev => 
      prev.includes(emotion) 
        ? prev.filter(e => e !== emotion)
        : [...prev, emotion]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedThemes([]);
    setSelectedEmotions([]);
    setDateRange({start: '', end: ''});
  };

  const hasActiveFilters = searchQuery || selectedThemes.length > 0 || selectedEmotions.length > 0 || dateRange.start || dateRange.end;

  return (
    <Card className="p-4 mb-4">
      {/* Main search input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          type="text"
          placeholder="Search your journal entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Advanced filters toggle */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              <Calendar className="h-4 w-4 mr-2" />
              <TranslatableText text="Advanced filters" />
            </Button>
          </CollapsibleTrigger>
          
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-1" />
              <TranslatableText text="Clear all" />
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4"
            >
              {/* Date range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    <TranslatableText text="From date" />
                  </label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    <TranslatableText text="To date" />
                  </label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Themes filter */}
              {allThemes.length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    <TranslatableText text="Filter by themes" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allThemes.slice(0, 8).map(theme => (
                      <Badge
                        key={theme}
                        variant={selectedThemes.includes(theme) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => handleThemeToggle(theme)}
                      >
                        #{theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Emotions filter */}
              {allEmotions.length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    <TranslatableText text="Filter by emotions" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allEmotions.slice(0, 8).map(emotion => (
                      <Badge
                        key={emotion}
                        variant={selectedEmotions.includes(emotion) ? "default" : "outline"}
                        className="cursor-pointer text-xs capitalize"
                        onClick={() => handleEmotionToggle(emotion)}
                      >
                        {emotion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>

      {/* Results summary */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
          <TranslatableText 
            text={`Showing ${filteredEntries.length} of ${entries.length} entries`} 
          />
        </div>
      )}
    </Card>
  );
};

export default JournalSearch;
