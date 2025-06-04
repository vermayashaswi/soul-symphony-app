
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatHeaderProps {
  onNewChat: () => void;
  onDeleteChat: () => void;
  canDelete: boolean;
  isDeletionDisabled: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ 
  onNewChat, 
  onDeleteChat, 
  canDelete, 
  isDeletionDisabled 
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-background">
      <h1 className="text-xl font-semibold text-foreground">
        <TranslatableText text="SOULo Chat" />
      </h1>
      
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onNewChat}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <TranslatableText text="New conversation" />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {canDelete && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`${
                    isDeletionDisabled 
                      ? 'text-muted-foreground/50 cursor-not-allowed' 
                      : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                  }`}
                  onClick={() => !isDeletionDisabled && onDeleteChat()}
                  disabled={isDeletionDisabled}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isDeletionDisabled ? (
                  <TranslatableText text="Cannot delete while processing" />
                ) : (
                  <TranslatableText text="Delete conversation" />
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;
