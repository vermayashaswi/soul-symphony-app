
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ChatContainer } from '@/components/chat/ChatContainer';

export default function Chat() {
  const { sidebar, content } = ChatContainer();
  
  return (
    <ChatLayout 
      sidebar={sidebar}
      content={content}
    />
  );
}
