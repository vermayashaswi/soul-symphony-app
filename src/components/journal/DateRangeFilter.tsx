
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { JournalEntry } from '@/types/journal';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  entries: JournalEntry[];
  onFilteredEntries: (filteredEntries: JournalEntry[]) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  entries,
  onFilteredEntries
}) => {
  const [date, setDate] = useState<DateRange | undefined>();

  const handleDateChange = (newDate: DateRange | undefined) => {
    setDate(newDate);

    if (newDate && newDate.from && newDate.to) {
      const filtered = entries.filter(entry => {
        const entryDate = new Date(entry.created_at);
        return entryDate >= newDate.from! && entryDate <= newDate.to!;
      });
      onFilteredEntries(filtered);
    } else {
      onFilteredEntries(entries);
    }
  };
  
  return (
    <div className="flex items-center space-x-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                `${format(date.from, "LLL dd, yyyy")} - ${format(date.to, "LLL dd, yyyy")}`
              ) : (
                `${format(date.from, "LLL dd, yyyy")} - Present`
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateRangeFilter;
