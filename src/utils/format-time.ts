
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
