
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatThreadListProps {
  userId: string | undefined;
  onSelectThread: (threadId: string) => void;
  onStartNewThread: () => void;
  currentThreadId: string | null;
}

export default function ChatThreadList({
  userId,
  onSelectThread,
  onStartNewThread,
  currentThreadId
}: ChatThreadListProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userId) {
      fetchThreads();
    }
  }, [userId]);

  // Set focus on the edit input when it becomes visible
  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingThreadId]);

  const fetchThreads = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching chat threads:', error);
        toast.error('Failed to load chat threads');
        return;
      }

      setThreads(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // First, delete all messages in the thread
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', threadId);

      if (messagesError) {
        toast.error('Failed to delete thread messages');
        return;
      }

      // Then delete the thread itself
      const { error } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadId);

      if (error) {
        toast.error('Failed to delete thread');
        return;
      }

      setThreads(threads.filter(thread => thread.id !== threadId));
      toast.success('Thread deleted');
      
      // If the deleted thread was selected, start a new thread
      if (currentThreadId === threadId) {
        onStartNewThread();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    }
  };

  const startEditingThread = (threadId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(threadId);
    setEditedTitle(currentTitle);
  };

  const saveEditedTitle = async (threadId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!editedTitle.trim()) {
      toast.error('Title cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_threads')
        .update({ 
          title: editedTitle.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId);

      if (error) {
        toast.error('Failed to update thread title');
        return;
      }

      setThreads(threads.map(thread => 
        thread.id === threadId 
          ? { ...thread, title: editedTitle.trim(), updated_at: new Date().toISOString() } 
          : thread
      ));
      
      toast.success('Thread title updated');
      cancelEditing();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    }
  };

  const cancelEditing = () => {
    setEditingThreadId(null);
    setEditedTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === 'Escape') {
      cancelEditing();
    } else if (e.key === 'Enter') {
      saveEditedTitle(threadId);
    }
  };

  return (
    <div className="h-full flex flex-col border-r border-border">
      <div className="p-4">
        <Button 
          onClick={onStartNewThread} 
          variant="default" 
          className="w-full justify-start"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <Separator />
      
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No chat history yet</p>
            <p className="text-sm">Start a new conversation</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {threads.map((thread) => (
              <li 
                key={thread.id}
                onClick={() => editingThreadId !== thread.id && onSelectThread(thread.id)}
                className={`p-2 rounded-md cursor-pointer flex items-center justify-between group hover:bg-accent hover:text-accent-foreground ${
                  currentThreadId === thread.id ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                {editingThreadId === thread.id ? (
                  <form 
                    className="flex-1 flex gap-1" 
                    onSubmit={(e) => saveEditedTitle(thread.id, e)}
                  >
                    <Input
                      ref={editInputRef}
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, thread.id)}
                      className="h-7 flex-1"
                    />
                    <div className="flex gap-1">
                      <Button 
                        type="submit" 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon"
                        onClick={cancelEditing}
                        className="h-7 w-7"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-medium">{thread.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(thread.updated_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={(e) => startEditingThread(thread.id, thread.title, e)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={(e) => deleteThread(thread.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
