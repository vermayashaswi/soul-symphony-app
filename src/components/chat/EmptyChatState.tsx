
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { useTutorial } from "@/contexts/TutorialContext";

const EmptyChatState: React.FC = () => {
  const { isActive, isInStep, tutorialCompleted } = useTutorial();
  const componentMounted = useRef(true);
  
  // Check if we're in the chat tutorial step
  const isInTutorialStep5 = isActive && isInStep(5);

  // Track when component unmounts to avoid state updates
  useEffect(() => {
    componentMounted.current = true;
    return () => {
      componentMounted.current = false;
    };
  }, []);

  // Special styling effect when tutorial step 5 is active
  useEffect(() => {
    if (isInTutorialStep5) {
      console.log("EmptyChatState: In tutorial step 5, ensuring visibility");
      // Tutorial is active and we're in step 5, ensure this component is visible
      const checkVisibility = () => {
        if (!componentMounted.current) return;
        
        const container = document.querySelector(".chat-messages-container");
        if (container && container instanceof HTMLElement) {
          container.style.backgroundColor = "#000000";
        }
        
        // Make sure this component is visible
        const emptyChatState = document.querySelector(".flex.flex-col.items-center.justify-center.p-6.text-center.h-full");
        if (emptyChatState && emptyChatState instanceof HTMLElement) {
          emptyChatState.style.visibility = "visible";
          emptyChatState.style.display = "flex";
          emptyChatState.style.opacity = "1";
          emptyChatState.style.zIndex = "5000";
        }
        
        // Make chat suggestions visible
        const suggestions = document.querySelectorAll(".chat-suggestion-button, .empty-chat-suggestion");
        suggestions.forEach(suggestion => {
          if (suggestion instanceof HTMLElement) {
            suggestion.style.display = "block";
            suggestion.style.visibility = "visible";
            suggestion.style.opacity = "1";
          }
        });
      };
      
      // Check immediately and repeatedly to ensure visibility
      checkVisibility();
      const intervalId = setInterval(checkVisibility, 500);
      
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [isInTutorialStep5]);

  // Re-initialize UI when tutorial completes
  useEffect(() => {
    if (tutorialCompleted) {
      console.log("EmptyChatState: Tutorial completed, refreshing UI");
      
      // Listen for chat refresh events
      const handleChatRefresh = () => {
        if (!componentMounted.current) return;
        
        console.log("EmptyChatState: Chat refresh event received");
        // Force a rerender by triggering a window resize event
        window.dispatchEvent(new Event('resize'));
        
        // Reset any lingering styles
        const emptyChatState = document.querySelector(".flex.flex-col.items-center.justify-center.p-6.text-center.h-full");
        if (emptyChatState && emptyChatState instanceof HTMLElement) {
          emptyChatState.style.visibility = "visible";
          emptyChatState.style.display = "flex";
          emptyChatState.style.opacity = "1";
        }
      };
      
      window.addEventListener('chatRefreshNeeded', handleChatRefresh);
      
      // Initial refresh
      handleChatRefresh();
      
      // Multiple refresh attempts to ensure UI is properly reset
      const timeoutId = setTimeout(handleChatRefresh, 300);
      const timeoutId2 = setTimeout(handleChatRefresh, 1000);
      
      return () => {
        window.removeEventListener('chatRefreshNeeded', handleChatRefresh);
        clearTimeout(timeoutId);
        clearTimeout(timeoutId2);
      };
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
      <div className={`mt-8 space-y-3 w-full max-w-md ${isInTutorialStep5 ? 'block' : ''}`}>
        <Button
          variant="secondary"
          size="sm"
          className={`w-full justify-start px-4 py-3 h-auto ${isInTutorialStep5 ? 'chat-question-highlight empty-chat-suggestion' : ''}`}
        >
          <TranslatableText text="How am I feeling today based on my journal entries?" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className={`w-full justify-start px-4 py-3 h-auto ${isInTutorialStep5 ? 'chat-question-highlight empty-chat-suggestion' : ''}`}
        >
          <TranslatableText text="What emotions have I experienced most frequently?" />
        </Button>
      </div>
    </motion.div>
  );
};

export default EmptyChatState;
