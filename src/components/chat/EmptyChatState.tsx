
import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useTutorial } from "@/contexts/TutorialContext";

const EmptyChatState: React.FC = () => {
  const { isActive, isInStep, tutorialCompleted } = useTutorial();
  
  // Check if we're in the chat tutorial step
  const isInTutorialStep5 = isActive && isInStep(5);

  // Special styling effect when tutorial step 5 is active
  useEffect(() => {
    if (isInTutorialStep5) {
      console.log("EmptyChatState: In tutorial step 5, ensuring visibility");
      // Tutorial is active and we're in step 5, ensure this component is visible
      const checkVisibility = () => {
        const container = document.querySelector(".chat-messages-container");
        if (container && container instanceof HTMLElement) {
          container.style.backgroundColor = "#000000";
        }
      };
      
      // Check immediately and after a short delay to ensure visibility
      checkVisibility();
      const timeoutId = setTimeout(checkVisibility, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isInTutorialStep5]);

  // Re-initialize UI when tutorial completes
  useEffect(() => {
    if (tutorialCompleted) {
      console.log("EmptyChatState: Tutorial completed, refreshing UI");
      // Small delay to ensure all tutorial cleanup is done
      const timeoutId = setTimeout(() => {
        // Force a rerender by triggering a window resize event
        window.dispatchEvent(new Event('resize'));
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [tutorialCompleted]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center p-6 text-center h-full"
      style={{
        visibility: 'visible',
        zIndex: isInTutorialStep5 ? 5000 : 'auto',
        position: 'relative'
      }}
    >
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-bold mb-2">
        <TranslatableText text="Start a Conversation" />
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-md">
        <TranslatableText text="Ask me anything about your thoughts, feelings, or daily life. I'm here to help!" />
      </p>
      
      {/* Only show the button if we're not in tutorial step 5 */}
      {!isInTutorialStep5 && (
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-6"
          onClick={() => {
            const newChatButton = document.querySelector('[data-testid="new-chat-button"]') as HTMLButtonElement;
            if (newChatButton) newChatButton.click();
          }}
        >
          <TranslatableText text="New Chat" />
        </Button>
      )}
      
      {/* Add chat suggestions that are more visible during tutorial */}
      {isInTutorialStep5 && (
        <div className="mt-8 space-y-3 w-full max-w-md">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-start px-4 py-3 h-auto chat-question-highlight empty-chat-suggestion"
          >
            <TranslatableText text="How am I feeling today based on my journal entries?" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-start px-4 py-3 h-auto chat-question-highlight empty-chat-suggestion"
          >
            <TranslatableText text="What emotions have I experienced most frequently?" />
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default EmptyChatState;
