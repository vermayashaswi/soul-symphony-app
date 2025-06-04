
import React from 'react';
import { DateRange } from 'react-day-picker';
import JournalSearch from './JournalSearch';
import DateRangeFilter from './DateRangeFilter';

interface JournalSearchAndFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const JournalSearchAndFilters: React.FC<JournalSearchAndFiltersProps> = ({
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="flex-1">
        <JournalSearch 
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      </div>
      <div className="flex-shrink-0">
        <DateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />
      </div>
    </div>
  );
};

export default JournalSearchAndFilters;
