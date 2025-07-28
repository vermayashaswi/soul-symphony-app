import React from 'react';

interface ConditionalRendererProps {
  condition: boolean;
  isLoading?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Utility component to conditionally render content with loading states
 * Helps prevent UI flicker by showing content only when conditions are met
 */
export const ConditionalRenderer: React.FC<ConditionalRendererProps> = ({
  condition,
  isLoading = false,
  fallback = null,
  children
}) => {
  if (isLoading) {
    return fallback;
  }
  
  if (!condition) {
    return null;
  }
  
  return <>{children}</>;
};