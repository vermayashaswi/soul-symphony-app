import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Check, X, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/types/chat';
import { getDownstreamMessages } from '@/services/chat/messageEditingService';

interface EditableMessageProps {
  message: ChatMessage;
  userId: string;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  isEditing: boolean;
  onStartEdit: (messageId: string) => void;
  onCancelEdit: () => void;
  isLoading?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const EditableMessage: React.FC<EditableMessageProps> = ({
  message,
  userId,
  onEdit,
  isEditing,
  onStartEdit,
  onCancelEdit,
  isLoading = false,
  className,
  children
}) => {
  const [editContent, setEditContent] = useState(message.content);
  const [downstreamCount, setDownstreamCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if this is a user message that can be edited
  const canEdit = message.sender === 'user';

  // Load downstream message count when editing starts
  useEffect(() => {
    if (isEditing && canEdit) {
      loadDownstreamCount();
      setShowWarning(true);
    }
  }, [isEditing, message.id, userId]);

  // Auto-resize textarea and focus when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      
      // Auto-resize
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, [isEditing]);

  const loadDownstreamCount = async () => {
    try {
      const downstreamMessages = await getDownstreamMessages(message.id, userId);
      setDownstreamCount(downstreamMessages.length);
    } catch (error) {
      console.error('Error loading downstream messages:', error);
      setDownstreamCount(0);
    }
  };

  const handleStartEdit = () => {
    setEditContent(message.content);
    onStartEdit(message.id);
  };

  const handleSave = async () => {
    const trimmedContent = editContent.trim();
    if (!trimmedContent) return;
    
    if (trimmedContent === message.content.trim()) {
      onCancelEdit();
      return;
    }

    try {
      await onEdit(message.id, trimmedContent);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const handleCancel = () => {
    setEditContent(message.content);
    setShowWarning(false);
    onCancelEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
    
    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  if (!canEdit) {
    return <div className={className}>{children}</div>;
  }

  if (isEditing) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Warning about downstream deletion */}
        {showWarning && downstreamCount > 0 && (
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
            disabled={isLoading}
            className="min-h-[80px] resize-none"
            placeholder="Edit your message..."
          />
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading || !editContent.trim() || editContent.trim() === message.content.trim()}
              className="flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              Save
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
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
    );
  }

  return (
    <div className={cn("group relative", className)}>
      {children}
      
      {/* Edit button - only show on hover for user messages */}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleStartEdit}
        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 bg-background border shadow-sm"
        title="Edit message"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  );
};