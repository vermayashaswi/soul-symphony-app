import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ChatThreadList } from "./ChatThreadList";
import SmartChatInterface from "./SmartChatInterface";
import { MentalHealthInsights } from "@/hooks/use-mental-health-insights";

interface DesktopChatLayoutProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId?: string;
  mentalHealthInsights?: MentalHealthInsights;
  isProcessingActive?: boolean;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

const DesktopChatLayout: React.FC<DesktopChatLayoutProps> = ({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights,
  isProcessingActive = false,
  onProcessingStateChange
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleCreateNewThread = async () => {
    const newThreadId = await onCreateNewThread();
    if (newThreadId) {
      onSelectThread(newThreadId);
    }
  };

  return (
    <div className="flex h-full w-full bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Sidebar Panel */}
        <ResizablePanel 
          defaultSize={25} 
          minSize={sidebarCollapsed ? 4 : 20} 
          maxSize={40}
          className={`transition-all duration-200 ${sidebarCollapsed ? 'min-w-16' : 'min-w-80'}`}
        >
          <div className="flex flex-col h-full border-r border-border bg-card">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
              {!sidebarCollapsed && (
                <h3 className="font-semibold text-foreground">Conversations</h3>
              )}
              <div className="flex items-center gap-1">
                {!sidebarCollapsed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCreateNewThread}
                    className={`h-8 w-8 text-muted-foreground hover:text-foreground ${
                      isProcessingActive ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={isProcessingActive ? "Cannot create new conversation while processing" : "New conversation"}
                    disabled={isProcessingActive}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => !isProcessingActive && setSidebarCollapsed(!sidebarCollapsed)}
                  className={`h-8 w-8 text-muted-foreground hover:text-foreground ${
                    isProcessingActive ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title={
                    isProcessingActive 
                      ? "Cannot toggle sidebar while processing" 
                      : (sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar")
                  }
                  disabled={isProcessingActive}
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Thread List */}
            <div className="flex-1 overflow-hidden">
              {sidebarCollapsed ? (
                <div className="p-2 space-y-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCreateNewThread}
                    className={`w-full h-10 ${
                      isProcessingActive ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title={isProcessingActive ? "Cannot create new conversation while processing" : "New conversation"}
                    disabled={isProcessingActive}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <ChatThreadList
                  activeThreadId={currentThreadId}
                  onSelectThread={onSelectThread}
                  onCreateThread={handleCreateNewThread}
                  showHeader={false} // We handle the header ourselves
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-1 bg-border hover:bg-muted-foreground/20 transition-colors" />

        {/* Chat Panel */}
        <ResizablePanel defaultSize={75} minSize={60}>
          <SmartChatInterface
            currentThreadId={currentThreadId}
            onSelectThread={onSelectThread}
            onCreateNewThread={onCreateNewThread}
            userId={userId}
            mentalHealthInsights={mentalHealthInsights}
            onProcessingStateChange={onProcessingStateChange}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DesktopChatLayout;