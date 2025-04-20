
import React from "react";
import { MessageSquare } from "lucide-react";

interface EmptyChatStateProps {
  isPlannerMode?: boolean;
}

const EmptyChatState: React.FC<EmptyChatStateProps> = ({ isPlannerMode = false }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <div className="bg-primary/10 rounded-full p-4 mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-medium mb-2">
        {isPlannerMode ? "AI Planner Assistant" : "AI Journal Insights"}
      </h3>
      
      <p className="text-muted-foreground max-w-md mb-4">
        {isPlannerMode 
          ? "Ask complex questions about your journal entries. The planner will analyze your data step-by-step to provide detailed insights."
          : "Ask about your journal entries and get personalized insights based on your writing."
        }
      </p>
      
      <div className="grid gap-2 mt-2 text-sm text-muted-foreground max-w-md">
        <p className="font-medium mb-1">Try asking:</p>
        {isPlannerMode ? (
          <>
            <div className="border rounded-lg p-2 bg-secondary/20">"How have things been with my wife and is it improving?"</div>
            <div className="border rounded-lg p-2 bg-secondary/20">"What patterns do you see in my anxiety over the past month?"</div>
            <div className="border rounded-lg p-2 bg-secondary/20">"Compare my mood on weekdays versus weekends"</div>
          </>
        ) : (
          <>
            <div className="border rounded-lg p-2 bg-secondary/20">"What emotions have I felt most often lately?"</div>
            <div className="border rounded-lg p-2 bg-secondary/20">"What did I write about yesterday?"</div>
            <div className="border rounded-lg p-2 bg-secondary/20">"Summarize my recent journal entries"</div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmptyChatState;
