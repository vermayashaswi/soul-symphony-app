import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { JournalEntry } from '@/types/journal';

interface DateRangeFilterProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ date, setDate }) => {
  return (
    <div className="space-x-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={'outline'}
            className={
              'justify-start text-left font-normal' +
              (date ? ' text-foreground' : ' text-muted-foreground')
            }
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'PPP') : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateRangeFilter;

