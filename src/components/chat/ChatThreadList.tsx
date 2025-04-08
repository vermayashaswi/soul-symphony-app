
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  MessageSquareText,
  X 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChatThread, getUserChatThreads, updateThreadTitle } from "@/services/chatPersistenceService";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ChatThreadListProps {
  userId?: string;
  onSelectThread: (threadId: string) => void;
  onStartNewThread: () => Promise<string | null>;
  currentThreadId: string | null;
  searchable?: boolean;
  newChatButtonWidth?: 'full' | 'half';
  showDeleteButtons?: boolean;
}

export default function ChatThreadList({
  userId,
  onSelectThread,
  onStartNewThread,
  currentThreadId,
  searchable = true,
  newChatButtonWidth = 'full',
  showDeleteButtons = false
}: ChatThreadListProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchThreads();
    } else {
      setLoading(false);
    }
    
    const titleUpdatedHandler = (event: CustomEvent) => {
      if (event.detail?.threadId && event.detail?.title) {
        updateThreadInList(event.detail.threadId, event.detail.title);
      }
    };
    
    window.addEventListener('threadTitleUpdated' as any, titleUpdatedHandler);
    
    return () => {
      window.removeEventListener('threadTitleUpdated' as any, titleUpdatedHandler);
    };
  }, [userId]);

  const fetchThreads = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const fetchedThreads = await getUserChatThreads(userId);
      setThreads(fetchedThreads);
    } catch (error) {
      console.error("Error fetching chat threads:", error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewThread = async () => {
    const newThreadId = await onStartNewThread();
    if (newThreadId) {
      await fetchThreads();
    }
  };

  const startEditingTitle = (thread: ChatThread) => {
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title);
  };

  const saveEditedTitle = async (threadId: string) => {
    if (!editingTitle.trim()) {
      setEditingTitle("New Conversation");
    }
    
    try {
      const success = await updateThreadTitle(threadId, editingTitle);
      if (success) {
        updateThreadInList(threadId, editingTitle);
        toast({
          title: "Success",
          description: "Conversation renamed successfully",
        });
      } else {
        throw new Error("Failed to update title");
      }
    } catch (error) {
      console.error("Error updating thread title:", error);
      toast({
        title: "Error",
        description: "Failed to rename conversation",
        variant: "destructive"
      });
    } finally {
      setEditingThreadId(null);
    }
  };

  const updateThreadInList = (threadId: string, newTitle: string) => {
    setThreads(prev => prev.map(thread => 
      thread.id === threadId ? { ...thread, title: newTitle } : thread
    ));
  };

  const deleteThread = async (threadId: string) => {
    try {
      // Delete messages first
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', threadId);
        
      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      // Then delete thread
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadId);
        
      if (threadError) {
        console.error("Error deleting thread:", threadError);
        throw threadError;
      }
      
      // Update local state
      setThreads(prev => prev.filter(thread => thread.id !== threadId));
      
      // If the deleted thread was the current one, dispatch an event so other components know
      if (threadId === currentThreadId) {
        const nextThread = threads.find(t => t.id !== threadId);
        if (nextThread) {
          onSelectThread(nextThread.id);
        } else {
          handleNewThread();
        }
      }
      
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  const filteredThreads = searchQuery
    ? threads.filter(thread => 
        thread.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  return (
    <div className="chat-thread-list h-full flex flex-col p-2">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          className={cn(
            "flex items-center gap-1 text-sm font-medium",
            newChatButtonWidth === 'full' ? "flex-1" : "w-1/2"
          )}
          onClick={handleNewThread}
        >
          <Plus className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
        
        {searchable && (
          <div className={cn(
            "relative",
            newChatButtonWidth === 'full' ? "w-full" : "w-1/2"
          )}>
            <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search chats"
              className="pl-8 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div 
              key={index}
              className="h-10 bg-muted/50 rounded-md animate-pulse my-1"
            />
          ))
        ) : filteredThreads.length > 0 ? (
          filteredThreads.map(thread => (
            <div
              key={thread.id}
              className={cn(
                "chat-thread-item group flex items-center justify-between px-2 py-2 text-sm rounded-md cursor-pointer",
                currentThreadId === thread.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              )}
              onClick={() => {
                if (editingThreadId !== thread.id) {
                  onSelectThread(thread.id);
                  // Close sidebar on mobile by dispatching event
                  window.dispatchEvent(new CustomEvent('closeChatSidebar'));
                }
              }}
            >
              {editingThreadId === thread.id ? (
                <div className="flex-1 flex items-center">
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="text-sm h-7"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveEditedTitle(thread.id);
                      } else if (e.key === 'Escape') {
                        setEditingThreadId(null);
                      }
                    }}
                    onBlur={() => saveEditedTitle(thread.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1 truncate">
                    <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{thread.title}</span>
                  </div>
                  
                  {showDeleteButtons && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          startEditingTitle(thread);
                        }}>
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteThread(thread.id);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No conversations found</p>
            <p className="text-xs mt-1">Start a new chat to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
