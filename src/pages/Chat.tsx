
import React, { useEffect, useState } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [key, setKey] = useState<number>(0); // Add a key to force re-render when needed

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

  // Listen for thread deletion and title update events to refresh the component
  useEffect(() => {
    const handleThreadDeleted = () => {
      // Force re-render of the entire component
      setKey(prevKey => prevKey + 1);
    };
    
    const handleThreadTitleUpdated = () => {
      // Force re-render when thread title is updated
      setKey(prevKey => prevKey + 1);
    };

    window.addEventListener('threadDeleted', handleThreadDeleted as EventListener);
    window.addEventListener('threadTitleUpdated', handleThreadTitleUpdated as EventListener);
    
    return () => {
      window.removeEventListener('threadDeleted', handleThreadDeleted as EventListener);
      window.removeEventListener('threadTitleUpdated', handleThreadTitleUpdated as EventListener);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col" key={key}>
      <SmartChatInterface />
    </div>
  );
};

export default Chat;
