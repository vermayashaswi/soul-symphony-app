
import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  MessageCircle, 
  Search,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [editThreadId, setEditThreadId] = useState<string | null>(null);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
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
    
    const handleThreadDeleted = (event: CustomEvent) => {
      if (event.detail?.threadId) {
        setThreads(prevThreads => 
          prevThreads.filter(thread => thread.id !== event.detail.threadId)
        );
      }
    };
    
    window.addEventListener('threadTitleUpdated' as any, handleTitleUpdated);
    window.addEventListener('threadDeleted' as any, handleThreadDeleted);
    
    return () => {
      window.removeEventListener('threadTitleUpdated' as any, handleTitleUpdated);
      window.removeEventListener('threadDeleted' as any, handleThreadDeleted);
    };
  }, [userId]);

  const filteredThreads = threads.filter(thread =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewThread = async () => {
    if (onStartNewThread) {
      await onStartNewThread();
    }
  };
  
  const handleRenameThread = async () => {
    if (!editThreadId || !newThreadTitle.trim()) return;
    
    try {
      const { error } = await supabase
        .from('chat_threads')
        .update({ 
          title: newThreadTitle,
          updated_at: new Date().toISOString()
        })
        .eq('id', editThreadId);
        
      if (error) throw error;
      
      // Update local threads state
      setThreads(prevThreads => 
        prevThreads.map(thread => 
          thread.id === editThreadId 
            ? { ...thread, title: newThreadTitle } 
            : thread
        )
      );
      
      // Close the dialog
      setIsRenameDialogOpen(false);
      setEditThreadId(null);
      
      // Dispatch event to update other components with new title
      window.dispatchEvent(
        new CustomEvent('threadTitleUpdated', { 
          detail: { 
            threadId: editThreadId, 
            title: newThreadTitle 
          } 
        })
      );
      
      toast({
        title: "Thread renamed",
        description: "The conversation has been renamed successfully.",
      });
    } catch (error) {
      console.error("Error renaming thread:", error);
      
      toast({
        title: "Error",
        description: "Failed to rename the conversation.",
        variant: "destructive"
      });
    }
  };
  
  const openRenameDialog = (threadId: string, currentTitle: string) => {
    setEditThreadId(threadId);
    setNewThreadTitle(currentTitle);
    setIsRenameDialogOpen(true);
  };

  return (
    <div className="chat-thread-list h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <Button
          variant="theme"
          onClick={handleNewThread}
          className={cn(
            "text-white flex items-center gap-1",
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
              <div key={thread.id} className="relative group">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start relative h-auto py-3 px-3 text-left",
                    thread.id === currentThreadId && "bg-muted"
                  )}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <div className="truncate mr-2">
                    <div className="flex items-center">
                      <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
                      <span className="truncate">{thread.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(new Date(thread.updated_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRenameDialog(thread.id, thread.title);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Edit</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      <Dialog 
        open={isRenameDialogOpen} 
        onOpenChange={setIsRenameDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-y-2">
            <Input
              id="name"
              value={newThreadTitle}
              onChange={(e) => setNewThreadTitle(e.target.value)}
              placeholder="Conversation name"
              className="w-full"
              autoFocus
            />
          </div>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRenameDialogOpen(false);
                setEditThreadId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRenameThread}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
