
import React from 'react';
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface SimpleJournalSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const SimpleJournalSearch: React.FC<SimpleJournalSearchProps> = ({
  searchQuery,
  onSearchChange,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search journal entries..."
        value={searchQuery}
        onChange={handleSearchChange}
        className="w-full pl-9"
      />
    </div>
  );
};

export default SimpleJournalSearch;
