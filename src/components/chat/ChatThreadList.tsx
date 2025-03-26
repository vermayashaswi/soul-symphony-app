
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getChatThreads, deleteChatThread } from '@/utils/supabase-helpers';
import { asDataArray } from '@/utils/supabase-type-utils';

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

  useEffect(() => {
    if (userId) {
      fetchThreads();
    } else {
      setThreads([]);
      setIsLoading(false);
    }
  }, [userId, currentThreadId]);

  const fetchThreads = async () => {
    try {
      setIsLoading(true);
      console.log("Fetching threads for user:", userId);
      
      if (!userId) {
        setThreads([]);
        return;
      }
      
      const fetchedThreads = await getChatThreads(userId);
      
      console.log("Threads fetched:", fetchedThreads.length || 0);
      
      // Safely cast the response data to our ChatThread type
      const typedThreads = fetchedThreads.map(thread => ({
        id: thread.id,
        title: thread.title,
        created_at: thread.created_at,
        updated_at: thread.updated_at
      }));
      
      setThreads(typedThreads);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const success = await deleteChatThread(threadId);
      
      if (success) {
        setThreads(threads.filter(thread => thread.id !== threadId));
        toast.success('Thread deleted');
        
        // If the deleted thread was selected, start a new thread
        if (currentThreadId === threadId) {
          onStartNewThread();
        }
      } else {
        toast.error('Failed to delete thread');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
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
                onClick={() => onSelectThread(thread.id)}
                className={`p-2 rounded-md cursor-pointer flex items-center justify-between group hover:bg-accent hover:text-accent-foreground ${
                  currentThreadId === thread.id ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{thread.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(thread.updated_at), 'MMM d, yyyy')}
                  </p>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="opacity-0 group-hover:opacity-100 h-7 w-7"
                  onClick={(e) => handleDeleteThread(thread.id, e)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
