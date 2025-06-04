
import React, { useState } from 'react';
import { CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface SimpleDateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const SimpleDateRangeFilter: React.FC<SimpleDateRangeFilterProps> = ({
  dateRange,
  onDateRangeChange,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleSelect = (selectedRange: DateRange | undefined) => {
    onDateRangeChange(selectedRange);
  };

  const clearFilters = () => {
    onDateRangeChange(undefined);
    setIsCalendarOpen(false);
  };

  const formatDateRange = () => {
    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`;
    } else if (dateRange?.from) {
      return `From ${format(dateRange.from, 'MMM d')}`;
    }
    return 'Filter by date';
  };

  const isFilterActive = dateRange?.from || dateRange?.to;

  return (
    <div>
      {isFilterActive ? (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1 bg-primary/10 text-primary border-primary"
          onClick={clearFilters}
        >
          <CalendarRange className="h-4 w-4" />
          <span className="truncate max-w-[200px]">{formatDateRange()}</span>
          <X className="h-3.5 w-3.5 ml-1" />
        </Button>
      ) : (
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-muted-foreground flex items-center gap-1"
            >
              <CalendarRange className="h-4 w-4" />
              <span>Filter by date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default SimpleDateRangeFilter;
