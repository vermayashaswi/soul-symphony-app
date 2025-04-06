
import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  MessageCircle, 
  Search, 
  Trash2,
  Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

interface ChatThreadListProps {
  userId?: string;
  onSelectThread: (threadId: string) => void;
  onStartNewThread: () => Promise<string | null>;
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
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
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
    
    const handleTitleUpdated = (event: CustomEvent) => {
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
    
    window.addEventListener('threadTitleUpdated' as any, handleTitleUpdated);
    
    return () => {
      window.removeEventListener('threadTitleUpdated' as any, handleTitleUpdated);
    };
  }, [userId]);

  useEffect(() => {
    if (editingThread && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingThread]);

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
        toast({
          title: "Error",
          description: "Failed to delete conversation",
          variant: "destructive",
          duration: 3000
        });
      } else {
        setThreads(threads.filter(thread => thread.id !== threadToDelete));
        toast({
          title: "Success",
          description: "Conversation deleted",
          duration: 3000
        });
        
        if (currentThreadId === threadToDelete) {
          onStartNewThread();
        }
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setThreadToDelete(null);
    }
  };
  
  const startEditingThread = (thread: any) => {
    setEditingThread(thread.id);
    setNewTitle(thread.title);
  };
  
  const handleUpdateThreadTitle = async (threadId: string) => {
    if (!newTitle.trim()) {
      setEditingThread(null);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('chat_threads')
        .update({ 
          title: newTitle.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId);
        
      if (error) {
        console.error("Error updating thread title:", error);
        toast({
          title: "Error",
          description: "Failed to update conversation title",
          variant: "destructive",
          duration: 3000
        });
      } else {
        setThreads(threads.map(thread => 
          thread.id === threadId 
            ? { ...thread, title: newTitle.trim() } 
            : thread
        ));
        toast({
          title: "Success",
          description: "Conversation title updated",
          duration: 3000
        });
      }
    } catch (error) {
      console.error("Error updating thread title:", error);
    } finally {
      setEditingThread(null);
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
            "w-full"
          )}
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
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
              <div key={thread.id} className="relative">
                {editingThread === thread.id ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <Input
                      ref={editInputRef}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateThreadTitle(thread.id);
                        } else if (e.key === 'Escape') {
                          setEditingThread(null);
                        }
                      }}
                      className="h-8"
                      maxLength={30}
                    />
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 px-2"
                        onClick={() => handleUpdateThreadTitle(thread.id)}
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 px-2"
                        onClick={() => setEditingThread(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center bg-background hover:bg-accent/50 rounded-md">
                    <Button
                      key={thread.id}
                      variant="ghost"
                      className={cn(
                        "flex-1 justify-start relative h-auto py-3 px-2 text-left rounded-r-none",
                        thread.id === currentThreadId && "bg-muted"
                      )}
                      onClick={() => onSelectThread(thread.id)}
                    >
                      <div className="flex-1 truncate mr-2">
                        <div className="flex items-center">
                          <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
                          <span className="truncate">{thread.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {format(new Date(thread.updated_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </Button>
                    
                    <div className="flex items-center pr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingThread(thread);
                        }}
                        title="Edit conversation title"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setThreadToDelete(thread.id);
                        }}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
