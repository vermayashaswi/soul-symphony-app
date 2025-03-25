
import React, { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-mobile';

interface ChatLayoutProps {
  sidebar: ReactNode;
  content: ReactNode;
}

export function ChatLayout({ sidebar, content }: ChatLayoutProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  return (
    <div className="flex h-screen max-h-screen overflow-hidden relative">
      {/* Sidebar with toggle for mobile */}
      <div 
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } h-full border-r border-border dark:border-border transition-all duration-300 overflow-hidden absolute md:relative z-10 bg-background`}
      >
        {sidebar}
      </div>
      
      {/* Toggle button for sidebar */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute left-0 top-4 z-20 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </Button>
      
      {/* Main content */}
      <div className={`flex-1 h-full overflow-hidden transition-all duration-300 ${!sidebarOpen ? 'ml-0' : 'ml-0 md:ml-64'}`}>
        {content}
      </div>
    </div>
  );
}
