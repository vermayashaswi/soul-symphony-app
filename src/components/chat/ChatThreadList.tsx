import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Check, X, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TranslatableText } from "@/components/translation/TranslatableText";
import { getChatThreads, updateChatThread } from "@/services/chat/threadService";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { recoverLostThreads, validateThreadExistence } from "@/utils/chat/threadRecovery";

interface ChatThreadListProps {
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread?: () => void;
  showHeader?: boolean;
}

// Helper function to translate chat strings
export function translateChatString(text: string): string {
  // This is a placeholder function that will be replaced with actual translation logic
  return text;
}

export const ChatThreadList: React.FC<ChatThreadListProps> = ({
  activeThreadId,
  onSelectThread,
  onCreateThread,
  showHeader = true,
}) => {
  const [threads, setThreads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const { user } = useAuth();
  
  // Load threads when component mounts or user changes
  useEffect(() => {
    const loadThreads = async () => {
      if (!user?.id) {
        setThreads([]);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const threadsData = await getChatThreads(user.id);
        setThreads(threadsData);
      } catch (error) {
        console.error("Error loading threads:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadThreads();
    
    // Listen for thread selection events
    const handleThreadSelected = (event: any) => {
      if (event.detail?.threadId) {
        // Update the active thread in the list
      }
    };
    
    // Listen for thread title updates
    const handleThreadTitleUpdated = (event: any) => {
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
    
    // Listen for thread recovery events
    const handleThreadRecovered = (event: any) => {
      const { threadId, title, messageCount, lastUpdated } = event.detail;
      console.log(`[ChatThreadList] Thread recovered: ${threadId} with ${messageCount} messages`);
      
      // Check if thread is already in the list
      setThreads(prevThreads => {
        const exists = prevThreads.some(thread => thread.id === threadId);
        if (!exists) {
          // Add the recovered thread to the list
          const recoveredThread = {
            id: threadId,
            title: title || 'Recovered Conversation',
            created_at: lastUpdated,
            updated_at: lastUpdated,
            user_id: user?.id || ''
          };
          return [recoveredThread, ...prevThreads];
        }
        return prevThreads;
      });
    };
    
    window.addEventListener('threadSelected', handleThreadSelected);
    window.addEventListener('threadTitleUpdated', handleThreadTitleUpdated);
    window.addEventListener('threadRecovered', handleThreadRecovered);
    
    // Set up real-time subscription for thread updates if user exists
    let subscription: any;
    if (user?.id) {
      subscription = supabase
        .channel(`threads_for_${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_threads',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadThreads();
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_threads',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadThreads();
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_threads',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          const deletedThread = payload.old as any;
          console.log(`[ChatThreadList] Thread deleted: ${deletedThread.id}`);
          
          // Remove deleted thread from local state
          setThreads(prev => prev.filter(thread => thread.id !== deletedThread.id));
          
          // If the deleted thread was active, select another thread
          if (deletedThread.id === activeThreadId && threads.length > 1) {
            const remainingThreads = threads.filter(t => t.id !== deletedThread.id);
            if (remainingThreads.length > 0) {
              onSelectThread(remainingThreads[0].id);
            }
          }
        })
        .subscribe();
    }
    
    // Recovery mechanism: attempt to recover lost threads after initial load
    const attemptRecovery = async () => {
      if (user?.id && threads.length === 0) {
        console.log('[ChatThreadList] No threads found, attempting recovery...');
        await recoverLostThreads(user.id);
      }
    };
    
    // Delay recovery attempt to allow initial load
    const recoveryTimeout = setTimeout(attemptRecovery, 2000);
    
    return () => {
      window.removeEventListener('threadSelected', handleThreadSelected);
      window.removeEventListener('threadTitleUpdated', handleThreadTitleUpdated);
      window.removeEventListener('threadRecovered', handleThreadRecovered);
      clearTimeout(recoveryTimeout);
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user?.id]);
  
  const handleEditStart = (thread: any) => {
    setEditingThreadId(thread.id);
    setEditedTitle(thread.title);
  };
  
  const handleEditCancel = () => {
    setEditingThreadId(null);
    setEditedTitle("");
  };
  
  const handleEditSave = async (threadId: string) => {
    if (!editedTitle.trim() || !user?.id) return;
    
    try {
      const success = await updateChatThread(threadId, { title: editedTitle.trim() }, user.id);
      if (success) {
        setThreads(prevThreads =>
          prevThreads.map(thread =>
            thread.id === threadId
              ? { ...thread, title: editedTitle.trim() }
              : thread
          )
        );
        
        // Dispatch event for other components to listen to
        window.dispatchEvent(
          new CustomEvent('threadTitleUpdated', { 
            detail: { threadId, title: editedTitle.trim() } 
          })
        );
      }
    } catch (error) {
      console.error("Error updating thread title:", error);
    }
    
    setEditingThreadId(null);
    setEditedTitle("");
  };

  return (
    <div className="h-full flex flex-col">
      {showHeader && (
        <div className="p-2 border-b flex items-center justify-between">
          <Button 
            className="flex items-center gap-1"
            onClick={onCreateThread}
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <TranslatableText text="New Chat" />
          </Button>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center p-4 text-sm text-muted-foreground">
            <TranslatableText text="No conversations yet" />
          </div>
        ) : (
          <div className="space-y-0.5">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className={`group px-2 py-2 rounded-md transition-colors ${
                  activeThreadId === thread.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/60"
                }`}
              >
                {editingThreadId === thread.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      autoFocus
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditSave(thread.id);
                        if (e.key === 'Escape') handleEditCancel();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleEditSave(thread.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={handleEditCancel}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => onSelectThread(thread.id)}
                  >
                    <div className="flex-1 truncate text-sm font-medium">
                      <TranslatableText text={thread.title} />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStart(thread);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
