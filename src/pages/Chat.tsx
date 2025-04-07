
import React, { useEffect, useState } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  // Get thread from URL if present
  useEffect(() => {
    const threadParam = searchParams.get('thread');
    if (threadParam) {
      setThreadId(threadParam);
      // Dispatch event to select this thread
      window.dispatchEvent(
        new CustomEvent('threadSelected', { 
          detail: { threadId: threadParam } 
        })
      );
    }
  }, [searchParams]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);
  
  // Listen for thread deleted events to refresh the component
  useEffect(() => {
    const handleThreadDeleted = () => {
      // Force refresh the SmartChatInterface component
      setKey(prevKey => prevKey + 1);
    };
    
    window.addEventListener('threadDeleted' as any, handleThreadDeleted);
    
    return () => {
      window.removeEventListener('threadDeleted' as any, handleThreadDeleted);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <SmartChatInterface key={key} />
    </div>
  );
};

export default Chat;
