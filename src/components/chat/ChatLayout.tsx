
import { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useEffect } from 'react';

interface ChatLayoutProps {
  sidebar: ReactNode;
  content: ReactNode;
}

export function ChatLayout({ sidebar, content }: ChatLayoutProps) {
  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  // Handle responsive layout
  useEffect(() => {
    setShowSidebar(!isMobile);
  }, [isMobile]);
  
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
                {sidebar}
              </ResizablePanel>
              <ResizableHandle />
            </>
          )}
          
          <ResizablePanel className="bg-background/80 backdrop-blur-md">
            {content}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
