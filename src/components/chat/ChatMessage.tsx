import React, { useState, useRef } from 'react';
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { formatShortDate } from "@/utils/format-time";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { TranslatableMarkdown } from "@/components/translation/TranslatableMarkdown";
import ParticleAvatar from "./ParticleAvatar";
import { getSanitizedFinalContent } from "@/utils/messageParser";
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { useLongPress } from '@/hooks/useLongPress';
import { EditContextMenu } from './EditContextMenu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ChatMessageProps {
  message: ChatMessageType;
  userId?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  userId
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [downstreamCount, setDownstreamCount] = useState(0);
  const messageRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const isUser = message.sender === 'user';
  const canEdit = isUser && userId;

  // Long press handler for edit functionality
  const longPressHandlers = useLongPress({
    onLongPress: () => {
      if (!canEdit) return;
      
      const rect = messageRef.current?.getBoundingClientRect();
      if (rect) {
        setContextMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top
        });
        setShowContextMenu(true);
      }
    },
    delay: 500,
    disabled: !canEdit || isEditing
  });

  const handleStartEdit = async () => {
    setEditContent(message.content);
    setIsEditing(true);
    
    // Load downstream message count
    try {
      const { data: downstreamMessages, error } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('thread_id', message.thread_id)
        .gt('created_at', message.created_at);
      
      if (!error && downstreamMessages) {
        setDownstreamCount(downstreamMessages.length);
      }
    } catch (error) {
      console.error('Error loading downstream messages:', error);
    }
    
    // Focus textarea after state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
      }
    }, 0);
  };

  const handleSaveEdit = async () => {
    const trimmedContent = editContent.trim();
    if (!trimmedContent || trimmedContent === message.content.trim()) {
      setIsEditing(false);
      return;
    }

    setIsEditLoading(true);
    
    try {
      // Delete downstream messages first
      const { error: deleteError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', message.thread_id)
        .gt('created_at', message.created_at);

      if (deleteError) {
        throw new Error('Failed to delete downstream messages');
      }

      // Update the message content
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ content: trimmedContent })
        .eq('id', message.id);

      if (updateError) {
        throw new Error('Failed to update message');
      }

      // Update thread timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', message.thread_id);

      setIsEditing(false);
      
      toast({
        title: "Success",
        description: `Message edited successfully. ${downstreamCount} downstream messages were removed.`,
        variant: "default"
      });

      // Reload the page to refresh the conversation
      window.location.reload();
      
    } catch (error: any) {
      console.error('Error editing message:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to edit message',
        variant: "destructive"
      });
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  // Get display content
  const displayContent = React.useMemo(() => {
    if (message.sender === 'assistant') {
      return getSanitizedFinalContent(message.content);
    }
    return message.content;
  }, [message.content, message.sender]);

  const messageContent = (
    <div className={cn("flex items-start space-x-3 mb-4", {
      "justify-end": isUser,
      "justify-start": !isUser,
    })}>
      {!isUser && (
        <Avatar className="h-8 w-8 border border-border/20 shadow-sm bg-background">
          <AvatarImage src="/lovable-uploads/d76c5c7d-ba89-4a31-8e33-2ab1bcc16e77.png" alt="AI Assistant" />
          <AvatarFallback className="bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600 text-xs">
            <ParticleAvatar />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn("max-w-[80%] space-y-2", {
        "order-first": isUser,
      })}>
        {/* Message bubble */}
        <div
          ref={canEdit ? messageRef : undefined}
          {...(canEdit ? longPressHandlers : {})}
          className={cn(
            "px-4 py-3 rounded-2xl shadow-sm border transition-all duration-200",
            {
              "bg-primary text-primary-foreground ml-auto": isUser,
              "bg-card text-card-foreground border-border/20": !isUser,
              "cursor-pointer select-none": canEdit && !isEditing,
              "ring-2 ring-primary/20": canEdit && !isEditing
            }
          )}
        >
          {isEditing ? (
            <div className="space-y-3">
              {/* Warning about downstream deletion */}
              {downstreamCount > 0 && (
                <Alert className="border-destructive/50 bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-sm">
                    Editing this message will delete{' '}
                    <Badge variant="destructive" className="mx-1">
                      {downstreamCount}
                    </Badge>
                    message{downstreamCount !== 1 ? 's' : ''} that come after it.
                    This action cannot be undone.
                  </AlertDescription>
                </Alert>
              )}

              {/* Edit form */}
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  disabled={isEditLoading}
                  className="min-h-[80px] resize-none bg-background text-foreground"
                  placeholder="Edit your message..."
                />
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isEditLoading || !editContent.trim() || editContent.trim() === message.content.trim()}
                    className="flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Save
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isEditLoading}
                    className="flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </Button>
                  
                  <div className="text-xs text-muted-foreground ml-auto">
                    Press Enter to save, Esc to cancel
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {isUser ? (
                <TranslatableText text={displayContent} />
              ) : (
                <TranslatableMarkdown>{displayContent}</TranslatableMarkdown>
              )}
              
              {/* Analysis metadata for assistant messages */}
              {message.analysis_data && message.analysis_data.sql_query && (
                <details className="mt-2 text-xs opacity-70">
                  <summary className="cursor-pointer hover:opacity-100">View SQL Query</summary>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                    {message.analysis_data.sql_query}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={cn("text-xs text-muted-foreground px-1", {
          "text-right": isUser,
          "text-left": !isUser,
        })}>
          {new Date(message.created_at).toLocaleString()}
        </div>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 border border-border/20 shadow-sm">
          <AvatarImage src={user?.user_metadata?.avatar_url} alt="User" />
          <AvatarFallback className="bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 text-xs">
            {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );

  return (
    <>
      {messageContent}
      
      {/* Context menu for edit */}
      <EditContextMenu
        isVisible={showContextMenu}
        position={contextMenuPosition}
        onEdit={handleStartEdit}
        onClose={() => setShowContextMenu(false)}
      />
    </>
  );
};

export default ChatMessage;