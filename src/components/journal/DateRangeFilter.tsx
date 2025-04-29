import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { JournalEntry } from '@/types/journal';

interface DateRangeFilterProps {
  entries: JournalEntry[];
  onFilterChange: (filteredEntries: JournalEntry[]) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ entries, onFilterChange }) => {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setIsOpen(false);
    
    if (!selectedDate) {
      // If date is cleared, show all entries
      onFilterChange(entries);
      return;
    }
    
    // Set time to beginning of day for comparison
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Set time to end of day for comparison
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Filter entries by date
    const filtered = entries.filter(entry => {
      const entryDate = new Date(entry.created_at);
      return entryDate >= startOfDay && entryDate <= endOfDay;
    });
    
    onFilterChange(filtered);
  };
  
  const clearFilter = () => {
    setDate(undefined);
    onFilterChange(entries);
  };

  return (
    <div className="flex items-center space-x-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[240px] justify-start text-left font-normal"
            onClick={() => setIsOpen(true)}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : <span>Filter by date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      
      {date && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearFilter}
          className="h-8 px-2"
        >
          Clear
        </Button>
      )}
    </div>
  );
};

export default DateRangeFilter;
