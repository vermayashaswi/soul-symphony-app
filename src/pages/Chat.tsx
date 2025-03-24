
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ChatArea from '@/components/chat/ChatArea';
import ChatThreadList from '@/components/chat/ChatThreadList';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useMobile } from '@/hooks/use-mobile';

export default function Chat() {
  const { user } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const isMobile = useMobile();
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  // Handle responsive layout
  useEffect(() => {
    setShowSidebar(!isMobile);
  }, [isMobile]);

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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <ParticleBackground />
      
      <div className="flex-1 pt-16 flex">
        <ResizablePanelGroup direction="horizontal" className="w-full h-full">
          {showSidebar && (
            <>
              <ResizablePanel 
                defaultSize={20} 
                minSize={15} 
                maxSize={30}
                className="bg-background/50 backdrop-blur-sm"
              >
                <ChatThreadList 
                  userId={user?.id}
                  onSelectThread={handleSelectThread}
                  onStartNewThread={handleStartNewThread}
                  currentThreadId={currentThreadId}
                />
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}
          
          <ResizablePanel className="bg-background/80 backdrop-blur-md">
            <ChatArea 
              userId={user?.id}
              threadId={currentThreadId}
              onNewThreadCreated={handleNewThreadCreated}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
