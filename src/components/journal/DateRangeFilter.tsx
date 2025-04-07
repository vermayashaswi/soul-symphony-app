
import React, { useState, useEffect } from 'react';
import { CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, isValid, endOfDay, startOfDay, isAfter, isBefore, isEqual } from 'date-fns';
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

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex flex-row items-center gap-2">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "justify-start text-left font-normal sm:w-[260px] text-xs sm:text-sm",
                  isFilterActive ? "border-primary text-primary" : "text-muted-foreground"
                )}
              >
                <CalendarRange className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {isFilterActive ? formatDateRange() : "Filter by date"}
                </span>
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
          
          {isFilterActive && (
            <Badge 
              variant="outline" 
              className="gap-1 px-2 py-1 bg-primary/10 text-primary text-xs"
            >
              {totalFiltered} of {totalEntries} entries
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-4 w-4 p-0 hover:bg-primary/20"
                onClick={clearFilters}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default DateRangeFilter;
