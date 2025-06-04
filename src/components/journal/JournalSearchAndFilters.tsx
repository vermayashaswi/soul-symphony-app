
import React from 'react';
import { DateRange } from 'react-day-picker';
import SimpleJournalSearch from './SimpleJournalSearch';
import SimpleDateRangeFilter from './SimpleDateRangeFilter';

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
        <SimpleJournalSearch 
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      </div>
      <div className="flex-shrink-0">
        <SimpleDateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />
      </div>
    </div>
  );
};

export default JournalSearchAndFilters;
