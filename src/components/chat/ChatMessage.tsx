
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AnalysisMetadataCard } from './AnalysisMetadataCard';
import ParticleAvatar from './ParticleAvatar';

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
  const isUser = message.sender === 'user';

  const customRenderers = {
    h1: ({ children }: any) => (
      <h1 className="text-lg font-bold mb-2 text-theme">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-base font-bold mb-2 text-theme">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-sm font-bold mb-2 text-theme">
        {children}
      </h3>
    ),
    strong: ({ children }: any) => (
      <strong className="font-bold text-theme">
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
        <span className="text-theme mt-1 text-sm">•</span>
        <span className="flex-1">{children}</span>
      </li>
    ),
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="mt-1">
          <ParticleAvatar className="h-8 w-8" size={32} />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        {/* Analysis Metadata Card for assistant messages */}
        {!isUser && message.analysisMetadata && (
          <AnalysisMetadataCard metadata={message.analysisMetadata} />
        )}

        <Card className={`${
          isUser 
            ? 'bg-theme text-white' 
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
          <AvatarImage 
            src={undefined} 
            alt="User"
            className="bg-muted"
            loading="eager"
          />
          <AvatarFallback className="bg-muted">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};
