
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { User } from 'lucide-react';
import { AnalysisMetadataCard } from './AnalysisMetadataCard';
import ParticleAvatar from './ParticleAvatar';
import { TranslatableMarkdown } from '@/components/translation/TranslatableMarkdown';
import { TranslatableText } from '@/components/translation/TranslatableText';

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
              <TranslatableText 
                text={message.content} 
                className="text-sm"
                forceTranslate={true}
                enableFontScaling={true}
                scalingContext="general"
              />
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert 
                prose-headings:text-theme prose-headings:font-bold
                prose-h1:text-lg prose-h1:mb-3 prose-h1:flex prose-h1:items-center prose-h1:gap-2
                prose-h2:text-base prose-h2:mb-3 prose-h2:mt-4 prose-h2:flex prose-h2:items-center prose-h2:gap-2
                prose-h3:text-sm prose-h3:mb-2 prose-h3:mt-3 prose-h3:flex prose-h3:items-center prose-h3:gap-2
                prose-strong:text-theme prose-strong:font-bold
                prose-ul:list-none prose-ul:space-y-2 prose-ul:ml-1 prose-ul:my-2
                prose-ol:list-decimal prose-ol:list-inside prose-ol:space-y-2 prose-ol:ml-4 prose-ol:my-2
                prose-li:flex prose-li:items-start prose-li:gap-2 prose-li:mb-1
                prose-p:mb-2 prose-p:leading-relaxed
                prose-blockquote:border-l-4 prose-blockquote:border-theme prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:my-3 prose-blockquote:bg-muted/30 prose-blockquote:rounded-r
              ">
                <TranslatableMarkdown 
                  className="text-sm leading-relaxed"
                  forceTranslate={true}
                  enableFontScaling={true}
                  scalingContext="general"
                >
                  {message.content}
                </TranslatableMarkdown>
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
