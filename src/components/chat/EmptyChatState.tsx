
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const EmptyChatState = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error('Error fetching user profile:', error);
          return;
        }
        
        if (data?.full_name) {
          // Extract first name from full name
          const nameParts = data.full_name.split(' ');
          if (nameParts.length > 0) {
            const firstName = nameParts[0];
            setFirstName(firstName);
          }
        }
      } catch (error) {
        console.error('Error in profile fetch:', error);
      }
    };
    
    fetchUserProfile();
  }, [user]);
  
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-16 h-16 mb-6 bg-primary/10 rounded-full flex items-center justify-center"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 bg-primary/5 rounded-full"
        />
        <MessageSquare className="h-8 w-8 text-primary" />
      </motion.div>
      
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-xl font-semibold mb-2"
      >
        {firstName ? `Hi ${firstName}, I am SOULO` : 'I am SOULO'}
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-muted-foreground max-w-md mb-6"
      >
        Your AI assistant that can analyze and chat about your journal entries.
        I can help you gain insights into your emotions, identify patterns, and reflect on your experiences.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg max-w-lg"
      >
        <p className="mb-2 font-medium">Try asking me:</p>
        <ul className="space-y-2 text-left list-disc pl-5">
          <li>How have I been feeling this week?</li>
          <li>What themes come up most often in my journal?</li>
          <li>When was the last time I wrote about feeling happy?</li>
          <li>Can you summarize my thoughts about work?</li>
        </ul>
      </motion.div>
    </div>
  );
};

export default EmptyChatState;
