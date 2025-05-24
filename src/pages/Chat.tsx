
import { useEffect, useState } from "react";
import { SmartChatInterface } from "@/components/chat/SmartChatInterface";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useMentalHealthInsights } from "@/hooks/use-mental-health-insights";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const { insights: mentalHealthInsights } = useMentalHealthInsights(user?.id);

  useEffect(() => {
    document.title = "Roha | Chat";
    
    if (!user) {
      navigate('/auth');
      return;
    }

    const initializeThread = async () => {
      try {
        // Check for existing threads
        const { data: threads, error } = await supabase
          .from('chat_threads')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (threads && threads.length > 0) {
          setCurrentThreadId(threads[0].id);
        } else {
          // Create new thread
          const newThreadId = uuidv4();
          const { error: createError } = await supabase
            .from('chat_threads')
            .insert({
              id: newThreadId,
              user_id: user.id,
              title: "New Conversation",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (createError) throw createError;
          setCurrentThreadId(newThreadId);
        }
      } catch (error) {
        console.error("Error initializing thread:", error);
        toast({
          title: "Error",
          description: "Failed to initialize chat thread",
          variant: "destructive"
        });
      }
    };

    if (user?.id) {
      initializeThread();
    }
  }, [user, navigate, toast]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-[calc(100vh-80px)] w-full"
    >
      <SmartChatInterface 
        mentalHealthInsights={mentalHealthInsights}
        currentThreadId={currentThreadId}
      />
    </motion.div>
  );
}
