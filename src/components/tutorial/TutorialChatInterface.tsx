
import React from 'react';
import { SmartChatInterface } from '@/components/chat/SmartChatInterface';

interface TutorialChatInterfaceProps {
  onSuggestionClick?: (suggestion: string) => void;
}

const TutorialChatInterface: React.FC<TutorialChatInterfaceProps> = ({ onSuggestionClick }) => {
  return (
    <div className="tutorial-chat-interface fixed inset-0 z-[9998]" style={{ 
      backgroundColor: '#1A1F2C',
      backgroundImage: 'linear-gradient(to bottom, #1A1F2C, #2D243A)',
      pointerEvents: 'none' // Prevent interactions in tutorial mode
    }}>
      <div className="h-full w-full max-w-4xl mx-auto">
        <SmartChatInterface />
      </div>
    </div>
  );
};

export default TutorialChatInterface;
