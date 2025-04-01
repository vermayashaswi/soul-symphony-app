
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ChatArea from '@/components/chat/ChatArea';
import ChatThreadList from '@/components/chat/ChatThreadList';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useMobile } from '@/hooks/use-mobile';
import { SidebarTrigger } from '@/components/ui/sidebar';

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

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Navbar />
      
      <div className="flex-1 pt-16 flex w-full h-[calc(100vh-4rem)]">
        {isMobile && (
          <div className="absolute top-20 left-4 z-10">
            <SidebarTrigger onClick={toggleSidebar} />
          </div>
        )}
        
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
              toggleSidebar={toggleSidebar}
              showSidebar={showSidebar}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
