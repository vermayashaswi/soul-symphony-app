
import React from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sun } from "lucide-react";

interface TypingIndicatorProps {
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Avatar className="h-8 w-8">
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-500">
          <Sun 
            className="w-5 h-5 text-yellow-100 animate-pulse" 
            style={{
              filter: 'drop-shadow(0 0 4px rgba(255, 165, 0, 0.8))'
            }}
          />
        </div>
        <AvatarFallback className="bg-orange-500">
          <Sun className="w-4 h-4 text-yellow-100" />
        </AvatarFallback>
      </Avatar>
      
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
