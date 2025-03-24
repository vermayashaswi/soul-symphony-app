
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import ChatArea from '@/components/chat/ChatArea';
import ChatThreadList from '@/components/chat/ChatThreadList';

export function ChatContainer() {
  const { user } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const handleStartNewThread = () => {
    setCurrentThreadId(null);
  };

  const handleNewThreadCreated = (threadId: string) => {
    setCurrentThreadId(threadId);
    toast.success('New chat started');
  };

  return {
    sidebar: (
      <ChatThreadList 
        userId={user?.id}
        onSelectThread={handleSelectThread}
        onStartNewThread={handleStartNewThread}
        currentThreadId={currentThreadId}
      />
    ),
    content: (
      <ChatArea 
        userId={user?.id}
        threadId={currentThreadId}
        onNewThreadCreated={handleNewThreadCreated}
      />
    )
  };
}
