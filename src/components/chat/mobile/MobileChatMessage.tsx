
import React from 'react';
import { format } from 'date-fns';
import { ChatMessage } from '@/types/chat';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Card } from '@/components/ui/card';

interface MobileChatMessageProps {
  message: ChatMessage;
}

export default function MobileChatMessage({ message }: MobileChatMessageProps) {
  const isUser = message.sender === 'user' || message.role === 'user';
  const isError = message.sender === 'error' || message.role === 'error';
  
  console.log("[MobileChatMessage] Rendering message:", {
    id: message.id,
    sender: message.sender,
    role: message.role,
    isUser,
    isError,
    contentLength: message.content?.length || 0
  });

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch {
      return '';
    }
  };

  // Helper function to safely check if reference_entries is an array
  const getReferenceEntries = () => {
    if (Array.isArray(message.reference_entries)) {
      return message.reference_entries;
    }
    if (Array.isArray(message.references)) {
      return message.references;
    }
    return [];
  };

  const referenceEntries = getReferenceEntries();
  
  // Safe check for array length
  const hasReferences = referenceEntries && referenceEntries.length > 0;

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        <Card className={`p-3 ${
          isUser 
            ? 'bg-primary text-primary-foreground ml-4' 
            : isError
              ? 'bg-destructive/10 border-destructive/20 mr-4'
              : 'bg-muted mr-4'
        }`}>
          <div className="space-y-2">
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
            
            {/* Show references if available */}
            {hasReferences && (
              <div className="mt-3 pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-1">
                  <TranslatableText text="Referenced entries:" />
                </div>
                <div className="space-y-1">
                  {referenceEntries.slice(0, 2).map((entry: any, index: number) => (
                    <div key={index} className="text-xs bg-background/50 rounded p-2">
                      <div className="text-muted-foreground">
                        {entry.created_at && formatTime(entry.created_at)}
                      </div>
                      <div className="line-clamp-2">
                        {typeof entry.content === 'string' ? `${entry.content.substring(0, 100)}...` : 'No content available'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                {isUser ? <TranslatableText text="You" /> : <TranslatableText text="Rūḥ" />}
              </span>
              {message.created_at && (
                <span>{formatTime(message.created_at)}</span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
