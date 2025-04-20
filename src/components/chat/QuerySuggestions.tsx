
import React from 'react';
import { Button } from '@/components/ui/button';

interface QuerySuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  onClose: () => void;
}

const suggestions = [
  // Emotional insights
  "How have my emotions changed over the past month?",
  "What patterns do you see in my mood fluctuations?",
  "When do I experience the most emotional volatility?",
  
  // Life area insights
  "What life areas am I writing about most frequently?",
  "How is my work-life balance based on my journal entries?",
  "Which aspects of my life bring me the most joy?",
  
  // Time comparisons
  "How has my journaling changed compared to last month?",
  "Am I more positive now than I was 30 days ago?",
  "What themes have become more prominent in my recent entries?",
  
  // Habit suggestions
  "What small habits might improve my wellbeing?",
  "Based on my journals, what microhabits would help me?",
  "Suggest some tiny actions that could boost my mood",
  
  // Reflection prompts
  "What should I journal about next?",
  "Give me personalized journal prompts based on my entries",
  "What areas of my life deserve more reflection?",
  
  // Journal patterns
  "Do I have any patterns of stopping journaling?",
  "When do I tend to take breaks from journaling?",
  "What emotions usually precede gaps in my journaling?",
  
  // Share-worthy content
  "Which of my journal entries are most meaningful?",
  "What entries should I revisit for personal growth?",
  "Which journal reflections show the most insight?"
];

const QuerySuggestions: React.FC<QuerySuggestionsProps> = ({ onSuggestionClick, onClose }) => {
  // Get a subset of random suggestions (10 max)
  const displaySuggestions = React.useMemo(() => {
    return [...suggestions]
      .sort(() => 0.5 - Math.random())
      .slice(0, 10);
  }, []);

  return (
    <div className="absolute bottom-full mb-2 left-0 w-full max-w-md bg-white border rounded shadow-lg z-50 p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-sm">Query Suggestions</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <ul className="space-y-1">
        {displaySuggestions.map((suggestion, i) => (
          <li key={i}>
            <button
              className="text-left w-full text-sm text-primary hover:underline"
              onClick={() => onSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default QuerySuggestions;
