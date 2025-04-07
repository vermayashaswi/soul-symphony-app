
import React, { useState, useEffect } from 'react';
import { CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, isValid, endOfDay, startOfDay, isAfter, isBefore, isEqual, isSameDay, isWithinInterval } from 'date-fns';
import { JournalEntry } from './JournalEntryCard';
import { Badge } from '@/components/ui/badge';

interface DateRangeFilterProps {
  entries: JournalEntry[];
  onFilterChange: (filteredEntries: JournalEntry[]) => void;
  onFilterActive: (isActive: boolean) => void;
}

export function DateRangeFilter({ entries, onFilterChange, onFilterActive }: DateRangeFilterProps) {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [month, setMonth] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [totalEntries, setTotalEntries] = useState(entries.length);
  const [totalFiltered, setTotalFiltered] = useState(0);

  // Initialize the month to the current month
  useEffect(() => {
    setMonth(new Date());
  }, []);

  // Filter entries when date range changes
  useEffect(() => {
    if (startDate || endDate) {
      setIsFilterActive(true);
      onFilterActive(true);
      
      const filtered = entries.filter(entry => {
        const entryDate = new Date(entry.created_at);
        
        // If only start date is set, filter entries after start date
        if (startDate && !endDate) {
          return isAfter(entryDate, startOfDay(startDate)) || isEqual(entryDate, startOfDay(startDate));
        }
        
        // If only end date is set, filter entries before end date
        if (endDate && !startDate) {
          return isBefore(entryDate, endOfDay(endDate)) || isEqual(entryDate, endOfDay(endDate));
        }
        
        // If both dates are set, filter entries between start and end dates
        if (startDate && endDate) {
          return (
            (isAfter(entryDate, startOfDay(startDate)) || isEqual(entryDate, startOfDay(startDate))) &&
            (isBefore(entryDate, endOfDay(endDate)) || isEqual(entryDate, endOfDay(endDate)))
          );
        }
        
        return true;
      });
      
      setTotalFiltered(filtered.length);
      onFilterChange(filtered);
    } else {
      setIsFilterActive(false);
      onFilterActive(false);
      setTotalFiltered(0);
      onFilterChange(entries);
    }
  }, [startDate, endDate, entries, onFilterChange, onFilterActive]);

  useEffect(() => {
    setTotalEntries(entries.length);
  }, [entries]);

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    
    if (!selectedDate) {
      return;
    }
    
    if (!startDate || (startDate && endDate)) {
      setStartDate(selectedDate);
      setEndDate(undefined);
    } else {
      // If the selected date is before the start date, switch them
      if (isBefore(selectedDate, startDate)) {
        setEndDate(startDate);
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setDate(undefined);
    onFilterChange(entries);
    setIsFilterActive(false);
    onFilterActive(false);
    setTotalFiltered(0);
    setIsCalendarOpen(false);
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    } else if (startDate) {
      return `From ${format(startDate, 'MMM d, yyyy')}`;
    } else if (endDate) {
      return `Until ${format(endDate, 'MMM d, yyyy')}`;
    }
    return 'Set date range';
  };

  // Custom day rendering to highlight the selected range
  const renderDay = (day: Date) => {
    const isSelected = date ? isSameDay(day, date) : false;
    
    // Check if day is within the selected range
    const isInRange = startDate && endDate && 
      isWithinInterval(day, { 
        start: startOfDay(startDate), 
        end: endOfDay(endDate) 
      });

    // Check if day is the start or end of the range
    const isRangeStart = startDate && isSameDay(day, startDate);
    const isRangeEnd = endDate && isSameDay(day, endDate);
    
    return (
      <div
        className={cn(
          "w-full h-9 relative flex items-center justify-center",
          isSelected && "font-semibold text-primary-foreground",
          isInRange && !isRangeStart && !isRangeEnd && "bg-primary/15",
          isRangeStart && endDate && "rounded-l-md bg-primary text-primary-foreground",
          isRangeEnd && startDate && "rounded-r-md bg-primary text-primary-foreground",
          // Single date selection (start without end or vice versa)
          ((isRangeStart && !endDate) || (isRangeEnd && !startDate)) && "bg-primary text-primary-foreground rounded-md"
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {(isInRange && !isRangeStart && !isRangeEnd) && (
            <div className="absolute inset-0 bg-primary/15"></div>
          )}
        </div>
        <span className="relative z-10">{format(day, 'd')}</span>
      </div>
    );
  };

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
              mode="single"
              selected={date}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
              initialFocus
              components={{
                Day: ({ day, ...props }) => renderDay(day)
              }}
              footer={
                <div className="p-3 border-t border-border">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                      {startDate && endDate 
                        ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
                        : startDate 
                          ? `From ${format(startDate, 'MMM d')}`
                          : endDate 
                            ? `Until ${format(endDate, 'MMM d')}`
                            : 'Select dates'
                      }
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={clearFilters}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              }
            />
          </PopoverContent>
        </Popover>
      )}
      
      {isFilterActive && (
        <Badge 
          variant="outline" 
          className="ml-2 gap-1 px-2 py-1 bg-primary/10 text-primary text-xs"
        >
          {totalFiltered} of {totalEntries} entries
        </Badge>
      )}
    </div>
  );
}

export default DateRangeFilter;
