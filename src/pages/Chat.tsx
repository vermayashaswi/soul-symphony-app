
import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ChatArea from '@/components/chat/ChatArea';
import ChatThreadList from '@/components/chat/ChatThreadList';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useMobile } from '@/hooks/use-mobile';
import { SidebarTrigger } from '@/components/ui/sidebar';
import MobilePreviewFrame from '@/components/MobilePreviewFrame';
import { useSwipeGesture } from '@/hooks/use-swipe-gesture';
import { useNavigate } from 'react-router-dom';

export default function Chat() {
  const { user } = useAuth();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const isMobile = useMobile();
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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

  // Add swipe gesture for sidebar toggling
  useSwipeGesture(chatContainerRef, {
    onSwipeRight: () => {
      // Open sidebar on swipe right
      if ((isMobile || mobileDemo) && !showSidebar) {
        setShowSidebar(true);
      }
    },
    onSwipeLeft: () => {
      // Close sidebar on swipe left if it's open
      if ((isMobile || mobileDemo) && showSidebar) {
        setShowSidebar(false);
      } else {
        // If sidebar is already closed, navigate to next page
        navigate('/insights');
      }
    },
    navigateOnEdge: true,
    navigateLeftTo: '/insights',
    navigateRightTo: '/journal',
  });

  useEffect(() => {
    document.title = "Chat | SOULo";
    
    // Force proper viewport setup for mobile
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) {
      metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    console.log("Chat page mounted, mobile:", isMobile, "width:", window.innerWidth, "mobileDemo:", mobileDemo);
  }, [isMobile, mobileDemo]);

  // Add event listener to close sidebar when clicking outside
  useEffect(() => {
    if (!isMobile && !mobileDemo) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (showSidebar && chatContainerRef.current) {
        // Check if click is outside the sidebar
        const sidebar = document.querySelector('.chat-sidebar');
        if (sidebar && !sidebar.contains(event.target as Node)) {
          setShowSidebar(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSidebar, isMobile, mobileDemo]);

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
    <div className="flex flex-col h-screen overflow-hidden bg-background" ref={chatContainerRef}>
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
                className="bg-background/50 backdrop-blur-sm chat-sidebar"
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
