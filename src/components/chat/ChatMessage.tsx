
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AnalysisMetadataCard } from './AnalysisMetadataCard';
import { useTheme } from '@/hooks/use-theme';

interface ChatMessageProps {
  message: {
    id: string;
    content: string;
    sender: 'user' | 'assistant';
    timestamp: string;
    analysisMetadata?: any;
  };
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { theme } = useTheme();
  const isUser = message.sender === 'user';

  const customRenderers = {
    h1: ({ children }: any) => (
      <h1 className={`text-lg font-bold mb-2 text-${theme.primary}`}>
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className={`text-base font-bold mb-2 text-${theme.primary}`}>
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className={`text-sm font-bold mb-2 text-${theme.primary}`}>
        {children}
      </h3>
    ),
    strong: ({ children }: any) => (
      <strong className={`font-bold text-${theme.primary}`}>
        {children}
      </strong>
    ),
    ul: ({ children }: any) => (
      <ul className="list-none space-y-1 ml-2">
        {children}
      </ul>
    ),
    li: ({ children }: any) => (
      <li className="flex items-start gap-2">
        <span className={`text-${theme.primary} mt-1 text-sm`}>•</span>
        <span className="flex-1">{children}</span>
      </li>
    ),
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className={`bg-${theme.primary} text-white`}>
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {/* Analysis Metadata Card for assistant messages */}
        {!isUser && message.analysisMetadata && (
          <AnalysisMetadataCard metadata={message.analysisMetadata} />
        )}

        <Card className={`${
          isUser 
            ? `bg-${theme.primary} text-white` 
            : 'bg-card'
        }`}>
          <CardContent className="p-3">
            {isUser ? (
              <p className="text-sm">{message.content}</p>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown 
                  components={customRenderers}
                  className="text-sm leading-relaxed"
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className="bg-muted">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};
