
import React from 'react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface EmptyChatStateProps {
  onStarterPrompt: (prompt: string) => void;
}

const EmptyChatState: React.FC<EmptyChatStateProps> = ({ onStarterPrompt }) => {
  const handlePromptClick = (prompt: string) => {
    if (onStarterPrompt) {
      onStarterPrompt(prompt);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">
          <TranslatableText text="Start a conversation" />
        </h3>
        <p className="text-muted-foreground">
          <TranslatableText text="Ask me anything about your journals, emotions, or patterns" />
        </p>
      </div>

      <div className="grid gap-2 w-full max-w-md">
        <Button 
          variant="outline" 
          className="justify-start text-left" 
          onClick={() => handlePromptClick("How have I been feeling this week?")}
        >
          <TranslatableText text="How have I been feeling this week?" />
        </Button>
        <Button 
          variant="outline" 
          className="justify-start text-left" 
          onClick={() => handlePromptClick("What topics have I written about most often?")}
        >
          <TranslatableText text="What topics have I written about most often?" />
        </Button>
        <Button 
          variant="outline" 
          className="justify-start text-left" 
          onClick={() => handlePromptClick("What patterns do you see in my emotions?")}
        >
          <TranslatableText text="What patterns do you see in my emotions?" />
        </Button>
      </div>
    </div>
  );
};

export default EmptyChatState;
