
import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTutorial } from '@/contexts/TutorialContext';
import { toast } from '@/hooks/use-toast';

/**
 * A button that allows users to escape from the tutorial if they get stuck
 */
export const TutorialEscapeButton: React.FC = () => {
  const { isActive, endTutorial } = useTutorial();
  
  if (!isActive) return null;
  
  const handleEscapeTutorial = async () => {
    try {
      await endTutorial();
      toast({
        title: "Tutorial Ended",
        description: "You can restart the tutorial anytime from settings.",
        variant: "success"
      });
    } catch (error) {
      console.error("Failed to end tutorial:", error);
      toast({
        title: "Error",
        description: "Could not end tutorial. Try refreshing the page.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="fixed top-4 right-4 z-[9999]">
      <Button 
        variant="destructive" 
        size="sm" 
        className="flex items-center gap-1"
        onClick={handleEscapeTutorial}
      >
        <X size={16} />
        <span>Exit Tutorial</span>
      </Button>
    </div>
  );
};

export default TutorialEscapeButton;
