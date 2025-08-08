
import React from 'react';


interface TypingIndicatorProps {
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      
      
      <div className="flex items-center space-x-1 bg-muted/60 border border-border/50 rounded-2xl rounded-tl-none px-4 py-3">
        <div className="flex space-x-1">
          <div 
            className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
            style={{
              animationDelay: '0ms',
              animationDuration: '1.4s'
            }}
          ></div>
          <div 
            className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
            style={{
              animationDelay: '200ms',
              animationDuration: '1.4s'
            }}
          ></div>
          <div 
            className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"
            style={{
              animationDelay: '400ms',
              animationDuration: '1.4s'
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
