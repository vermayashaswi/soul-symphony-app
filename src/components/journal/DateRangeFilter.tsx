import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { JournalEntry } from '@/types/journal'; // Fixed import from types instead of JournalEntryCard

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ dateRange, onDateRangeChange }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center space-x-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !dateRange?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                `${format(dateRange.from, "MMM dd, yyyy")} - ${format(
                  dateRange.to,
                  "MMM dd, yyyy"
                )}`
              ) : (
                format(dateRange.from, "MMM dd, yyyy")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from ? dateRange.from : new Date()}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            pagedNavigation
            className="border-0 rounded-md shadow-sm"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateRangeFilter;
