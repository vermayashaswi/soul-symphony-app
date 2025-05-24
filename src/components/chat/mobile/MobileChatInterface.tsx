
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Menu, MessageSquare } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ChatThreadList } from '../ChatThreadList';
import { SmartChatInterface } from '../SmartChatInterface';

interface MobileChatInterfaceProps {
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateNewThread: () => Promise<string | null>;
  userId: string | undefined;
  mentalHealthInsights?: any;
}

const MobileChatInterface: React.FC<MobileChatInterfaceProps> = ({
  currentThreadId,
  onSelectThread,
  onCreateNewThread,
  userId,
  mentalHealthInsights
}) => {
  const [showThreadList, setShowThreadList] = useState(false);

  const handleSelectThread = (threadId: string) => {
    onSelectThread(threadId);
    setShowThreadList(false);
  };

  const handleCreateNewThread = async () => {
    const newThreadId = await onCreateNewThread();
    if (newThreadId) {
      setShowThreadList(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mobile Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Sheet open={showThreadList} onOpenChange={setShowThreadList}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <ChatThreadList
              activeThreadId={currentThreadId}
              onSelectThread={handleSelectThread}
              onCreateThread={handleCreateNewThread}
            />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="font-medium">SOULo Chat</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleCreateNewThread}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <SmartChatInterface 
          mentalHealthInsights={mentalHealthInsights}
          currentThreadId={currentThreadId}
        />
      </div>
    </div>
  );
};

export default MobileChatInterface;
