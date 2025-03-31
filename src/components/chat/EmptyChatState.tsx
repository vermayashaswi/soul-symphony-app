
import React from "react";

const EmptyChatState: React.FC = () => {
  return (
    <div className="text-center text-muted-foreground p-4 md:p-8">
      <p>Start a conversation with your journal by asking a question.</p>
      <div className="mt-4 text-sm">
        <p className="font-medium">Try questions like:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-left max-w-md mx-auto">
          <li>"How did I feel about work last week?"</li>
          <li>"What are my top 3 emotions in my journal?"</li>
          <li>"When was I feeling most anxious and why?"</li>
          <li>"What's the sentiment trend in my journal?"</li>
          <li>"My top 3 positive and negative emotions?"</li>
        </ul>
      </div>
    </div>
  );
};

export default EmptyChatState;
