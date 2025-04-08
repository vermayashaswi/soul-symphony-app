
import React, { useState } from 'react';
import { AlertTriangle, X, Activity } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SupabaseStatusChecker from './SupabaseStatusChecker';

const MaintenanceBanner = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!isVisible) return null;

  return (
    <>
      <Alert 
        variant="warning" 
        className="sticky top-0 z-[100] rounded-none border-t-0 border-x-0 py-2 px-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm font-medium">
            We're currently under maintenance. Be Right Back!
          </AlertDescription>
          <DialogTrigger asChild onClick={() => setIsDialogOpen(true)}>
            <Button variant="ghost" size="sm" className="ml-2 text-xs h-6 px-2">
              <Activity className="h-3 w-3 mr-1" />
              Check Status
            </Button>
          </DialogTrigger>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>System Status</DialogTitle>
          </DialogHeader>
          <SupabaseStatusChecker />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MaintenanceBanner;
