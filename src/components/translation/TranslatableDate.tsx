
import React from 'react';
import { formatDate } from 'date-fns';
import { TranslatableText } from './TranslatableText';

interface TranslatableDateProps {
  date: Date | string;
  className?: string;
}

export function TranslatableDate({ date, className = "" }: TranslatableDateProps) {
  try {
    const inputDate = typeof date === 'string' ? new Date(date) : date;
    
    // Validate the date
    if (!inputDate || isNaN(inputDate.getTime())) {
      console.error('[TranslatableDate] Invalid date:', date);
      return <TranslatableText text="Recently" forceTranslate={true} className={className} />;
    }
    
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - inputDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Today
    if (diffInDays === 0) {
      return <TranslatableText text="Today" forceTranslate={true} className={className} />;
    }
    
    // Yesterday
    if (diffInDays === 1) {
      return <TranslatableText text="Yesterday" forceTranslate={true} className={className} />;
    }
    
    // This week (within 6 days) - translate day names
    if (diffInDays < 7) {
      const dayName = formatDate(inputDate, 'EEEE'); // Returns day name like "Monday"
      return <TranslatableText text={dayName} forceTranslate={true} className={className} />;
    }
    
    // This year - translate month names
    if (inputDate.getFullYear() === now.getFullYear()) {
      const monthDay = formatDate(inputDate, 'MMM d'); // Returns format like "Jan 15"
      const [month, day] = monthDay.split(' ');
      return (
        <span className={className}>
          <TranslatableText text={month} forceTranslate={true} /> {day}
        </span>
      );
    }
    
    // Previous years - translate month names
    const monthDayYear = formatDate(inputDate, 'MMM d, yyyy'); // Returns format like "Jan 15, 2023"
    const [monthDay, year] = monthDayYear.split(', ');
    const [month, day] = monthDay.split(' ');
    return (
      <span className={className}>
        <TranslatableText text={month} forceTranslate={true} /> {day}, {year}
      </span>
    );
  } catch (error) {
    console.error('[TranslatableDate] Error formatting date:', error);
    return <TranslatableText text="Recently" forceTranslate={true} className={className} />;
  }
}

export default TranslatableDate;
