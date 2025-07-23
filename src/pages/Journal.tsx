
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Journal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/app/auth');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen pb-20 journal-container safe-area-top">
      <div className="max-w-4xl mx-auto px-4 pt-4 md:pt-8">
        <div className="flex flex-col mb-8">
          <h1 className="text-3xl font-bold mb-2">Journal</h1>
          <p className="text-muted-foreground">
            Record your thoughts and experiences
          </p>
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-muted-foreground">Journal functionality coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Journal;
