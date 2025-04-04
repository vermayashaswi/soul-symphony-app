
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { JournalEntry } from './JournalEntryCard';
import { Search } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from '@/hooks/use-mobile';
import { scrollToTop } from '@/hooks/use-scroll-restoration';

interface JournalSearchProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
}

const JournalSearch: React.FC<JournalSearchProps> = ({ entries, onSelectEntry }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    const filteredEntries = entries.filter(entry => {
      const content = (entry.content || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      // Check content for match
      if (content.includes(query)) return true;
      
      // Check entities for match
      if (entry.entities) {
        try {
          // Entities are usually stored as JSON
          const entityData = typeof entry.entities === 'string' 
            ? JSON.parse(entry.entities) 
            : entry.entities;
          
          // Check if any entity matches the search query
          if (entityData && Array.isArray(entityData)) {
            return entityData.some(entity => 
              entity.name?.toLowerCase().includes(query) || 
              entity.type?.toLowerCase().includes(query)
            );
          } else if (entityData && typeof entityData === 'object') {
            // Handle case where entities might be an object
            return Object.values(entityData).some(value => 
              value && String(value).toLowerCase().includes(query)
            );
          }
        } catch (e) {
          console.error("Error parsing entities:", e);
        }
      }
      
      // Check themes for match - use both themes and master_themes for compatibility
      if (entry.themes && Array.isArray(entry.themes)) {
        return entry.themes.some(theme => 
          theme.toLowerCase().includes(query)
        );
      }
      
      // Also check master_themes if themes is not available
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        return entry.master_themes.some(theme => 
          theme.toLowerCase().includes(query)
        );
      }
      
      return false;
    });

    setFilteredEntries(filteredEntries);
  }, [searchQuery, entries]);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search journal entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => scrollToTop()} // Add this line
            className="w-full pl-9"
          />
        </div>

        {searchQuery && (
          <div className="mt-4">
            {filteredEntries.length > 0 ? (
              <ScrollArea className="h-[200px] md:h-[300px] rounded-md">
                {filteredEntries.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="p-2 hover:bg-secondary cursor-pointer rounded-md"
                    onClick={() => onSelectEntry(entry)}
                  >
                    {entry.content}
                  </div>
                ))}
              </ScrollArea>
            ) : (
              <div className="text-muted-foreground">No entries found.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JournalSearch;
