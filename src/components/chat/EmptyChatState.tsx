
import React from "react";
import { motion } from "framer-motion";
import { MessageSquare, Brain, BarChart2, Search, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

const EmptyChatState: React.FC = () => {
  const suggestionQuestions = [
    {
      text: "What are the top 3 reasons that make me happy?",
      icon: <Lightbulb className="h-4 w-4 flex-shrink-0" />
    },
    {
      text: "What time of the day do i usually journal?",
      icon: <Search className="h-4 w-4 flex-shrink-0" />
    },
    {
      text: "Top 3 issues in my life?",
      icon: <BarChart2 className="h-4 w-4 flex-shrink-0" />
    },
    {
      text: "Suggest me ways to improve my negative traits.",
      icon: <Brain className="h-4 w-4 flex-shrink-0" />
    },
    {
      text: "Rate my top 3 emotions out of 10 for each of them.",
      icon: <BarChart2 className="h-4 w-4 flex-shrink-0" />
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center p-6 text-center h-full overflow-hidden max-w-full"
    >
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-bold mb-2">AI Assistant</h3>
      
      <p className="text-muted-foreground max-w-md overflow-hidden">
        Hey, I am Roha, your personal AI assistant. You can ask me anything about your mental well-being and I will answer your queries basis your own journal insights.
      </p>
      
      <div className="mt-6 text-sm text-muted-foreground/70 w-full max-w-md">
        <p>Try questions like:</p>
        <ul className="mt-2 space-y-2 w-full">
          {suggestionQuestions.map((question, index) => (
            <li key={index} className="flex items-start gap-2 text-left overflow-hidden break-words">
              <span className="mt-0.5 flex-shrink-0">{question.icon}</span>
              <span className="break-words overflow-hidden">{question.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

export default EmptyChatState;
