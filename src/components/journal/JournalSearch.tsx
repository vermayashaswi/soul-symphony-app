
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, X, Calendar, ThumbsUp } from 'lucide-react';
import { useSearch } from '@/hooks/use-search';
import { format } from 'date-fns';
import { EmotionBadge } from '@/components/EmotionBadge';
import { Badge } from '@/components/ui/badge';

interface JournalSearchProps {
  userId?: string;
  onSelectEntry?: (entryId: number) => void;
  onSearch: (query: string) => void;
}

export function JournalSearch({ userId, onSelectEntry, onSearch }: JournalSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const { searchResults, isSearching, searchQuery, search, clearResults } = useSearch(userId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      search(inputValue);
      onSearch(inputValue);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <Input
          placeholder="Search journal entries..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isSearching || !inputValue.trim()}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {searchResults.length > 0 && (
          <Button variant="ghost" onClick={clearResults} type="button">
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              Results for: <span className="font-normal italic">{searchQuery}</span>
            </h3>
            <Badge variant="outline">{searchResults.length} entries found</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {searchResults.map((result) => (
              <Card
                key={result.id}
                className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onSelectEntry?.(result.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(result.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>{(result.similarity * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <p className="text-sm line-clamp-3 mb-3">{result.content}</p>

                <div className="space-y-2">
                  {result.emotions && result.emotions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.emotions.slice(0, 3).map((emotion, index) => (
                        <EmotionBadge key={index} emotion={emotion} size="sm" />
                      ))}
                      {result.emotions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{result.emotions.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {result.master_themes && result.master_themes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.master_themes.slice(0, 3).map((theme, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                      {result.master_themes.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{result.master_themes.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
