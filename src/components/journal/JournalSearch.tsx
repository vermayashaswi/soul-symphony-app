
import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';

interface JournalSearchProps {
  onSearch: (query: string) => void;
  totalEntries: number;
  filteredCount: number;
}

const PLACEHOLDER_EXAMPLES = [
  "husband",
  "work",
  "meeting",
  "project",
  "friend",
  "manager",
  "vacation",
  "cigarettes",
  "time of day",
  "morning"
];

const JournalSearch: React.FC<JournalSearchProps> = ({ onSearch, totalEntries, filteredCount }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPlaceholder, setCurrentPlaceholder] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [charIndex, setCharIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animation for the placeholder text
  useEffect(() => {
    if (isTyping) {
      if (charIndex < PLACEHOLDER_EXAMPLES[placeholderIndex].length) {
        timeoutRef.current = setTimeout(() => {
          setCurrentPlaceholder(prev => 
            prev + PLACEHOLDER_EXAMPLES[placeholderIndex][charIndex]
          );
          setCharIndex(charIndex + 1);
        }, 100 + Math.random() * 50); // Random typing speed for realism
      } else {
        // Pause at the end of typing
        timeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      // Deleting text
      if (charIndex > 0) {
        timeoutRef.current = setTimeout(() => {
          setCurrentPlaceholder(prev => prev.slice(0, -1));
          setCharIndex(charIndex - 1);
        }, 50);
      } else {
        // Move to the next example
        const nextIndex = (placeholderIndex + 1) % PLACEHOLDER_EXAMPLES.length;
        setPlaceholderIndex(nextIndex);
        setIsTyping(true);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [charIndex, isTyping, placeholderIndex]);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  // Handle focus state
  const handleFocus = () => {
    setIsFocused(true);
    // Scroll to the top of the page when focused
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBlur = () => {
    if (!searchQuery) {
      setIsFocused(false);
    }
  };

  return (
    <motion.div 
      className={`relative mb-6 ${isFocused ? 'sticky top-0 z-30 bg-background pt-4 pb-2 border-b' : ''}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="pl-10 pr-4 py-2 w-full rounded-md"
          placeholder={`Search entries by ${currentPlaceholder}`}
        />
      </div>
      
      {/* Entry count indicator */}
      <div className="text-sm text-muted-foreground mt-2 px-1">
        {searchQuery ? (
          <span>{filteredCount} {filteredCount === 1 ? 'entry' : 'entries'} found</span>
        ) : (
          <span>{totalEntries} total {totalEntries === 1 ? 'entry' : 'entries'}</span>
        )}
      </div>
    </motion.div>
  );
};

export default JournalSearch;
