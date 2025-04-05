
import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  MessageCircle, 
  Search, 
  Trash2,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';

interface ChatThreadListProps {
  userId?: string;
  onSelectThread: (threadId: string) => void;
  onStartNewThread: () => Promise<void>;
  currentThreadId?: string | null;
  newChatButtonWidth?: 'full' | 'half';
}

export default function ChatThreadList({ 
  userId, 
  onSelectThread, 
  onStartNewThread,
  currentThreadId,
  newChatButtonWidth = 'full'
}: ChatThreadListProps) {
  const [threads, setThreads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchThreads = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        
        if (error) {
          console.error("Error fetching threads:", error);
        } else {
          setThreads(data || []);
        }
      } catch (error) {
        console.error("Error fetching threads:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThreads();
  }, [userId]);

  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewThread = async () => {
    if (onStartNewThread) {
      await onStartNewThread();
    }
  };

  const handleDeleteThread = async () => {
    if (!threadToDelete) return;

    try {
      const { error } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadToDelete);

      if (error) {
        console.error("Error deleting thread:", error);
      } else {
        setThreads(threads.filter(thread => thread.id !== threadToDelete));
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    } finally {
      setThreadToDelete(null);
    }
  };

  return (
    <div className="chat-thread-list h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <Button
          variant="default"
          onClick={handleNewThread}
          className={cn(
            "bg-theme-color hover:bg-theme-color/90 text-white flex items-center gap-1",
            "w-full" // Always use full width for the button, removing the half-width option
          )}
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
        
        {/* Removed the close/cross button that was here */}
      </div>
      
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="space-y-2 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No conversations yet</p>
            <p className="text-sm">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="space-y-1 py-2">
            {filteredThreads.map((thread) => (
              <Button
                key={thread.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start relative pr-10 py-6 h-auto text-left",
                  thread.id === currentThreadId && "bg-muted"
                )}
                onClick={() => onSelectThread(thread.id)}
              >
                <div className="flex-1 truncate">
                  <div className="flex items-center">
                    <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate">{thread.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {format(new Date(thread.updated_at), 'MMM d, h:mm a')}
                  </p>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setThreadToDelete(thread.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Button>
            ))}
          </div>
        )}
      </ScrollArea>
      
      <AlertDialog open={!!threadToDelete} onOpenChange={(open) => !open && setThreadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all of its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteThread}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
