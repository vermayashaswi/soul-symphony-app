
import React, { useEffect } from 'react';
import SmartChatInterface from '@/components/chat/SmartChatInterface';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  return (
    <div className="w-full h-full flex flex-col">
      <SmartChatInterface />
    </div>
  );
};

export default Chat;
