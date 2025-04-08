
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const MaintenanceBanner = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <Alert 
      variant="warning" 
      className="sticky top-0 z-[100] rounded-none border-t-0 border-x-0 py-2 px-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm font-medium">
          We're currently under maintenance. Be Right Back!
        </AlertDescription>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 rounded-full p-0" 
        onClick={() => setIsVisible(false)}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </Button>
    </Alert>
  );
};

export default MaintenanceBanner;
