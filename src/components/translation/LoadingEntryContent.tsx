
import React from 'react';

export function LoadingEntryContent() {
  return (
    <div className="animate-pulse flex flex-col space-y-2">
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  );
}

export default LoadingEntryContent;
