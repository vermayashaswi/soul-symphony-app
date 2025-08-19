
import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { JournalEntry } from '@/types/journal';
import { Search } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

interface JournalSearchProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onSearchResults: (filteredEntries: JournalEntry[], searchQuery: string) => void;
}

const searchPrompts = [
  "emotions",
  "memories",
  "places",
  "people",
  "thoughts",
  "events",
  "feelings",
  "themes",
  "issues",
  "entities"
];

const JournalSearch: React.FC<JournalSearchProps> = ({ entries, onSelectEntry, onSearchResults }) => {
  const { translate } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEntries, setFilteredEntries] = useState<JournalEntry[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typingPlaceholder, setTypingPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [typingIndex, setTypingIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [translatedPrompts, setTranslatedPrompts] = useState<string[]>([]);
  const [translatedSearchFor, setTranslatedSearchFor] = useState<string>("Search for");
  const inputRef = useRef<HTMLInputElement>(null);
  const mobile = useIsMobile();

  // Translate "Search for" text
  useEffect(() => {
    const translateSearchFor = async () => {
      if (translate) {
        const translated = await translate("Search for", "en");
        setTranslatedSearchFor(translated);
      }
    };
    
    translateSearchFor();
    
    window.addEventListener('languageChange', translateSearchFor as EventListener);
    return () => {
      window.removeEventListener('languageChange', translateSearchFor as EventListener);
    };
  }, [translate]);

  // Translate the search prompts when language changes
  useEffect(() => {
    const translatePrompts = async () => {
      if (translate) {
        const translated = await Promise.all(
          searchPrompts.map(prompt => translate(prompt, "en"))
        );
        setTranslatedPrompts(translated);
      }
    };
    
    translatePrompts();
    
    // Reset the animation when language changes
    setTypingPlaceholder("");
    setTypingIndex(0);
    setIsTyping(true);
    setPlaceholderIndex(0);
    
    window.addEventListener('languageChange', translatePrompts as EventListener);
    return () => {
      window.removeEventListener('languageChange', translatePrompts as EventListener);
    };
  }, [translate]);

  useEffect(() => {
    if (isTyping) {
      const currentWord = translatedPrompts.length > placeholderIndex 
        ? translatedPrompts[placeholderIndex] 
        : searchPrompts[placeholderIndex];
      
      if (typingIndex < currentWord.length) {
        const typingTimeout = setTimeout(() => {
          setTypingPlaceholder(currentWord.substring(0, typingIndex + 1));
          setTypingIndex(typingIndex + 1);
        }, 100);
        
        return () => clearTimeout(typingTimeout);
      } else {
        const pauseTimeout = setTimeout(() => {
          setIsTyping(false);
        }, 1500);
        
        return () => clearTimeout(pauseTimeout);
      }
    } else {
      if (typingIndex > 0) {
        const erasingTimeout = setTimeout(() => {
          const currentWord = translatedPrompts.length > placeholderIndex 
            ? translatedPrompts[placeholderIndex] 
            : searchPrompts[placeholderIndex];
          setTypingPlaceholder(currentWord.substring(0, typingIndex - 1));
          setTypingIndex(typingIndex - 1);
        }, 60);
        
        return () => clearTimeout(erasingTimeout);
      } else {
        const nextWordTimeout = setTimeout(() => {
          setPlaceholderIndex((prevIndex) => (prevIndex + 1) % searchPrompts.length);
          setIsTyping(true);
        }, 300);
        
        return () => clearTimeout(nextWordTimeout);
      }
    }
  }, [isTyping, typingIndex, placeholderIndex, translatedPrompts]);

  useEffect(() => {
    const handleBackButton = (event: PopStateEvent) => {
      if (isFocused) {
        event.preventDefault();
        if (inputRef.current) {
          inputRef.current.blur();
        }
        setIsFocused(false);
        window.history.pushState(null, '', window.location.pathname);
      }
    };
    
    if (isFocused) {
      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handleBackButton);
    }
    
    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [isFocused]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEntries(entries);
      onSearchResults(entries, searchQuery);
      return;
    }

    const filtered = entries.filter(entry => {
      const content = (entry.content || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      if (content.includes(query)) return true;
      
      if (entry.entities) {
        try {
          const entityData = typeof entry.entities === 'string' 
            ? JSON.parse(entry.entities) 
            : entry.entities;
          
          if (entityData && Array.isArray(entityData)) {
            return entityData.some(entity => 
              entity.name?.toLowerCase().includes(query) || 
              entity.type?.toLowerCase().includes(query)
            );
          } else if (entityData && typeof entityData === 'object') {
            return Object.values(entityData).some(value => 
              value && String(value).toLowerCase().includes(query)
            );
          }
        } catch (e) {
          console.error("Error parsing entities:", e);
        }
      }
      
      if (entry.themes && Array.isArray(entry.themes)) {
        return entry.themes.some(theme => 
          theme.toLowerCase().includes(query)
        );
      }
      
      if (entry.master_themes && Array.isArray(entry.master_themes)) {
        return entry.master_themes.some(theme => 
          theme.toLowerCase().includes(query)
        );
      }
      
      return false;
    });

    setFilteredEntries(filtered);
    onSearchResults(filtered, searchQuery);
  }, [searchQuery, entries, onSearchResults]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
  };

  const handleEntrySelect = (entry: JournalEntry) => {
    onSelectEntry(entry);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <Card 
      className={`w-full transition-all duration-300 border-none shadow-none backdrop-blur-none ${isFocused 
        ? 'fixed top-0 left-0 right-0 z-50 rounded-none bg-white dark:bg-gray-900 opacity-100' 
        : 'sticky top-0 z-10 bg-transparent'}`}
    >
      <CardContent className="p-1 py-1">
        <div className="flex flex-col space-y-0.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={`${translatedSearchFor} ${typingPlaceholder}${isTyping ? '|' : ''}`}
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="w-full pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1 py-0.5"> 
            <div className="text-xs text-muted-foreground">
              <TranslatableText 
                text={`${filteredEntries.length} total ${filteredEntries.length === 1 ? 'entry' : 'entries'}`} 
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JournalSearch;
