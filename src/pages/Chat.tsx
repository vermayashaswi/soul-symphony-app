
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ChatArea from '@/components/chat/ChatArea';
import ChatThreadList from '@/components/chat/ChatThreadList';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useMobile } from '@/hooks/use-mobile';
import { SidebarTrigger } from '@/components/ui/sidebar';
import MobilePreviewFrame from '@/components/MobilePreviewFrame';

export default function Chat() {
  const { user } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const isMobile = useMobile();
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  // Check if we're in mobile preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';

  // Handle responsive layout
  useEffect(() => {
    // Only auto-hide sidebar on real mobile devices, not in preview
    if (!mobileDemo) {
      setShowSidebar(!isMobile);
    }
  }, [isMobile, mobileDemo]);

  useEffect(() => {
    document.title = "Chat | SOULo";
    
    // Force proper viewport setup for mobile
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    console.log("Chat page mounted, mobile:", isMobile, "width:", window.innerWidth, "mobileDemo:", mobileDemo);
  }, [isMobile, mobileDemo]);

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

  // Content for both desktop and mobile views
  const chatContent = (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <Navbar />
      
      <div className="flex-1 pt-16 flex w-full h-[calc(100vh-4rem)]">
        {(isMobile || mobileDemo) && (
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

  // If we're in mobile demo mode, wrap the content in the MobilePreviewFrame
  return mobileDemo ? <MobilePreviewFrame>{chatContent}</MobilePreviewFrame> : chatContent;
}
