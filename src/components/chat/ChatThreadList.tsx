
import React, { useState, useEffect } from 'react';
import { ChatThread, getUserChatThreads } from '@/services/chat';
import { Plus, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatThreadListProps {
  userId?: string;
  onSelectThread: (threadId: string) => void;
  onStartNewThread: () => Promise<string | null>;
  currentThreadId: string | null;
  showDeleteButtons?: boolean;
}

const ChatThreadList: React.FC<ChatThreadListProps> = ({
  userId,
  onSelectThread,
  onStartNewThread,
  currentThreadId,
  showDeleteButtons = true
}) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingThread, setCreatingThread] = useState(false);
  
  useEffect(() => {
    const loadThreads = async () => {
      if (!userId) {
        setThreads([]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const threads = await getUserChatThreads(userId);
        setThreads(threads);
      } catch (error) {
        console.error("Error loading chat threads:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadThreads();
    
    // Subscribe to changes in chat threads
    const handleThreadTitleUpdate = (event: CustomEvent) => {
      if (event.detail?.threadId && event.detail?.title) {
        setThreads(prevThreads => 
          prevThreads.map(thread => 
            thread.id === event.detail.threadId 
              ? { ...thread, title: event.detail.title } 
              : thread
          )
        );
      }
    };
    
    window.addEventListener('threadTitleUpdated' as any, handleThreadTitleUpdate);
    
    return () => {
      window.removeEventListener('threadTitleUpdated' as any, handleThreadTitleUpdate);
    };
  }, [userId]);
  
  const handleStartNewThread = async () => {
    if (!userId) return;
    
    setCreatingThread(true);
    try {
      const newThreadId = await onStartNewThread();
      if (newThreadId) {
        // Reload the thread list
        const updatedThreads = await getUserChatThreads(userId);
        setThreads(updatedThreads);
      }
    } catch (error) {
      console.error("Error creating new thread:", error);
    } finally {
      setCreatingThread(false);
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <Button 
          onClick={handleStartNewThread}
          className="w-full"
          disabled={creatingThread}
        >
          {creatingThread ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          New Conversation
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          <ul className="space-y-1 p-2">
            {threads.map(thread => (
              <li key={thread.id}>
                <button 
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md flex items-start hover:bg-secondary/50 transition-colors",
                    currentThreadId === thread.id ? "bg-secondary" : ""
                  )}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <MessageCircle className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                  <span className="text-sm line-clamp-2">{thread.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ChatThreadList;
