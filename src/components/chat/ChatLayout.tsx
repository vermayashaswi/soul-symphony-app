
import React, { ReactNode } from 'react';

interface ChatLayoutProps {
  sidebar: ReactNode;
  content: ReactNode;
}

export function ChatLayout({ sidebar, content }: ChatLayoutProps) {
  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
      <div className="w-64 h-full border-r border-border dark:border-border">
        {sidebar}
      </div>
      <div className="flex-1 h-full overflow-hidden">
        {content}
      </div>
    </div>
  );
}
