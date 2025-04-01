
import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';

interface JournalSearchProps {
  onSearch: (query: string) => void;
}

const PLACEHOLDER_EXAMPLES = [
  "husband",
  "work",
  "meeting",
  "project",
  "friend",
  "manager",
  "vacation",
  "cigarettes"
];

const JournalSearch: React.FC<JournalSearchProps> = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPlaceholder, setCurrentPlaceholder] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [charIndex, setCharIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <motion.div 
      className="relative mb-6"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          className="pl-10 pr-4 py-2 w-full rounded-md"
          placeholder={`Search entries by ${currentPlaceholder}`}
        />
      </div>
      {/* Removed the guidance text */}
    </motion.div>
  );
};

export default JournalSearch;
