
import { formatRelative, format, differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { de } from 'date-fns/locale/de';
import { hi } from 'date-fns/locale/hi';
import { zhCN } from 'date-fns/locale/zh-CN';  // Using zhCN instead of zh
import { ja } from 'date-fns/locale/ja';
import { ru } from 'date-fns/locale/ru';
import { ar } from 'date-fns/locale/ar';
import { pt } from 'date-fns/locale/pt';

// Helper function to get locale based on language code
const getLocale = (lang: string) => {
  switch (lang.substring(0, 2)) {
    case 'es': return es;
    case 'fr': return fr;
    case 'de': return de;
    case 'hi': return hi;
    case 'zh': return zhCN;  // Using zhCN for Chinese
    case 'ja': return ja;
    case 'ru': return ru;
    case 'ar': return ar;
    case 'pt': return pt;
    default: return enUS;
  }
};

// Format a timestamp to a relative time string (e.g., "2 hours ago")
export const formatRelativeTime = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return 'just now'; // Changed to show "just now" for entries within the last hour
  }

  // Get the language from the HTML document
  // This will use whatever language the TranslationContext has set on the document
  const lang = document.documentElement.lang || 'en';
  console.log(`formatRelativeTime: Using language: ${lang}`);

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
};

// Format a timestamp to a short date format (e.g., "Jan 5" or "Jan 5, 2024")
export const formatShortDate = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const isCurrentYear = date.getFullYear() === now.getFullYear();
  
  // Get the language from the HTML document
  // This will use whatever language the TranslationContext has set on the document
  const lang = document.documentElement.lang || 'en';
  console.log(`formatShortDate: Using language: ${lang} for date: ${date}`);
  
  try {
    // Use options to format the date according to the user's language
    if (isCurrentYear) {
      // If it's the current year, show only the month and day
      return date.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
    } else {
      // If it's a different year, include the year
      return date.toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch (error) {
    console.error('Date formatting error:', error);
    // Fallback to a safe format
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }
};

// Export the original format-time function to maintain compatibility
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};
