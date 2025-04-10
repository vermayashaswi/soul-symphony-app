import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, MessageSquare, Trash2, X, Pencil, Check } from "lucide-react";
import { getUserChatThreads } from "@/services/chatPersistenceService";
import { updateThreadTitle } from "@/services/chat/threadService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { truncateText } from "@/utils/textUtils";
import { useChatDebug } from "@/components/chat/ChatDebugPanel";
import { Input } from "@/components/ui/input";

interface ChatThreadListProps {
  userId?: string;
  onSelectThread: (threadId: string) => void;
  onStartNewThread: () => Promise<string | null>;
  currentThreadId?: string | null;
  newChatButtonWidth?: "full" | "half";
  showDeleteButtons?: boolean;
}

export default function ChatThreadList({
  userId,
  onSelectThread,
  onStartNewThread,
  currentThreadId,
  newChatButtonWidth = "full",
  showDeleteButtons = true
}: ChatThreadListProps) {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const chatDebug = useChatDebug();
  
  useEffect(() => {
    if (userId) {
      loadThreads();
    } else {
      setLoading(false);
    }
    
    const handleThreadTitleUpdate = (event: CustomEvent) => {
      if (event.detail.threadId && event.detail.title) {
        chatDebug?.addEvent("Thread Update", `Updating thread title: ${event.detail.threadId} -> ${event.detail.title}`, "info");
        setThreads(prev => prev.map(thread => 
          thread.id === event.detail.threadId 
            ? { ...thread, title: event.detail.title } 
            : thread
        ));
      }
    };
    
    window.addEventListener('threadTitleUpdated' as any, handleThreadTitleUpdate);
    
    return () => {
      window.removeEventListener('threadTitleUpdated' as any, handleThreadTitleUpdate);
    };
  }, [userId]);

  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingThreadId]);

  const loadThreads = async () => {
    if (!userId) return;
    
    setLoading(true);
    chatDebug?.addEvent("Thread List", `Fetching threads for user: ${userId}`, "info");
    try {
      console.log("Fetching threads for user:", userId);
      
      const threadList = await getUserChatThreads(userId);
      console.log(`Found ${threadList.length} threads`);
      chatDebug?.addEvent("Thread List", `Found ${threadList.length} threads`, "success");
      
      setThreads(threadList);
    } catch (error) {
      console.error("Error loading threads:", error);
      chatDebug?.addEvent("Thread List", `Error loading threads: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewThread = async () => {
    try {
      chatDebug?.addEvent("Thread Creation", "Creating new thread", "info");
      const newThreadId = await onStartNewThread();
      
      if (newThreadId) {
        chatDebug?.addEvent("Thread Creation", `Created new thread: ${newThreadId}`, "success");
        console.log("Created new thread:", newThreadId);
        
        await loadThreads();
      }
    } catch (error) {
      chatDebug?.addEvent("Thread Creation", `Error creating new thread: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      console.error("Error creating new thread:", error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
    }
  };

  const deleteThread = async (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      chatDebug?.addEvent("Thread Deletion", `Deleting thread: ${threadId}`, "info");
      console.log("Deleting thread:", threadId);
      
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('thread_id', threadId);
        
      if (messagesError) {
        chatDebug?.addEvent("Thread Deletion", `Error deleting messages: ${messagesError.message}`, "error");
        console.error("Error deleting messages:", messagesError);
        throw messagesError;
      }
      
      const { error: threadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('id', threadId);
        
      if (threadError) {
        chatDebug?.addEvent("Thread Deletion", `Error deleting thread: ${threadError.message}`, "error");
        console.error("Error deleting thread:", threadError);
        throw threadError;
      }
      
      chatDebug?.addEvent("Thread Deletion", "Thread and messages deleted successfully", "success");
      setThreads(prev => prev.filter(thread => thread.id !== threadId));
      
      if (threadId === currentThreadId) {
        chatDebug?.addEvent("Thread Deletion", "Deleted current thread, creating new thread", "info");
        console.log("Deleted current thread, creating new thread");
        await handleNewThread();
      }
      
      toast({
        title: "Success",
        description: "Conversation deleted",
      });
    } catch (error) {
      chatDebug?.addEvent("Thread Deletion", `Error deleting thread: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      console.error("Error deleting thread:", error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  const startEditingThread = (threadId: string, currentTitle: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingThreadId(threadId);
    setEditTitle(currentTitle);
  };

  const saveThreadTitle = async (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!editTitle.trim()) {
      toast({
        title: "Error",
        description: "Title cannot be empty",
        variant: "destructive"
      });
      return;
    }
    
    try {
      chatDebug?.addEvent("Thread Edit", `Updating thread title: ${threadId} -> ${editTitle}`, "info");
      const success = await updateThreadTitle(threadId, editTitle);
      
      if (success) {
        setThreads(prev => prev.map(thread => 
          thread.id === threadId 
            ? { ...thread, title: editTitle } 
            : thread
        ));
        
        toast({
          title: "Success",
          description: "Thread title updated",
        });
        
        chatDebug?.addEvent("Thread Edit", "Thread title updated successfully", "success");
      } else {
        throw new Error("Failed to update thread title");
      }
    } catch (error) {
      chatDebug?.addEvent("Thread Edit", `Error updating thread title: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      console.error("Error updating thread title:", error);
      toast({
        title: "Error",
        description: "Failed to update thread title",
        variant: "destructive"
      });
    } finally {
      setEditingThreadId(null);
    }
  };

  const handleKeyDown = (threadId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveThreadTitle(threadId, e as unknown as React.MouseEvent);
    } else if (e.key === 'Escape') {
      setEditingThreadId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        {newChatButtonWidth === "full" ? (
          <>
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={handleNewThread}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="default"
              className="flex-1 justify-center"
              onClick={handleNewThread}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              New Chat
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => window.dispatchEvent(new CustomEvent('closeChatSidebar'))}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center space-x-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No conversations yet. Start a new chat.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {threads.map(thread => (
              <div
                key={thread.id}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer ${
                  currentThreadId === thread.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => onSelectThread(thread.id)}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                  {editingThreadId === thread.id ? (
                    <div className="flex-1 pr-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(thread.id, e)}
                        className={`h-7 py-0 px-2 text-sm ${
                          currentThreadId === thread.id
                            ? "bg-primary-foreground/10 text-primary-foreground border-primary-foreground/30"
                            : "bg-background border-input"
                        }`}
                      />
                    </div>
                  ) : (
                    <span className="truncate">{truncateText(thread.title, 24)}</span>
                  )}
                </div>
                
                <div className="flex items-center">
                  {editingThreadId === thread.id ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${
                        currentThreadId === thread.id
                          ? "hover:bg-primary-foreground/20 text-primary-foreground"
                          : "hover:bg-background/80 text-muted-foreground"
                      }`}
                      onClick={(e) => saveThreadTitle(thread.id, e)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 opacity-50 hover:opacity-100 ${
                        currentThreadId === thread.id
                          ? "hover:bg-primary-foreground/20 text-primary-foreground"
                          : "hover:bg-background/80 text-muted-foreground"
                      }`}
                      onClick={(e) => startEditingThread(thread.id, thread.title, e)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  
                  {showDeleteButtons && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 opacity-50 hover:opacity-100 ${
                        currentThreadId === thread.id
                          ? "hover:bg-primary-foreground/20 text-primary-foreground"
                          : "hover:bg-background/80 text-muted-foreground hover:text-destructive"
                      }`}
                      onClick={(e) => deleteThread(thread.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
