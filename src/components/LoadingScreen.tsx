import React from 'react';

interface LoadingScreenProps {
  status?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ status = 'Loading...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground text-sm">{status}</p>
      </div>
    </div>
  );
};