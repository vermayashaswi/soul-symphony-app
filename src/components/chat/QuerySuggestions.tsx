
import React from 'react';
import { Button } from '@/components/ui/button';

interface QuerySuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  onClose: () => void;
}

const suggestions = [
  "How have I been feeling lately?",
  "What patterns do you see in my mood?",
  "Summarize my recent journal entries",
  "Compare my emotions on weekends versus weekdays"
];

const QuerySuggestions: React.FC<QuerySuggestionsProps> = ({ onSuggestionClick, onClose }) => {
  return (
    <div className="absolute bottom-full mb-2 left-0 w-full max-w-md bg-white border rounded shadow-lg z-50 p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-sm">Query Suggestions</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <ul className="space-y-1">
        {suggestions.map((suggestion, i) => (
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
