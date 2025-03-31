
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const EmptyChatState: React.FC = () => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState<string>("");
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
            
          if (error) {
            console.error("Error fetching profile:", error);
            return;
          }
          
          if (data?.full_name) {
            // Extract first name from full name
            const firstNameOnly = data.full_name.split(' ')[0];
            setFirstName(firstNameOnly);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
    };
    
    fetchUserProfile();
  }, [user]);

  return (
    <div className="text-center text-muted-foreground p-4 md:p-8">
      <p>{firstName ? `Hi ${firstName}, I am Roha, your personal AI Assistant. I'm here to help you reflect on your thoughts and feelings. How are you doing today?` : 
        "I am Roha, your personal AI Assistant. I'm here to help you reflect on your thoughts and feelings. How are you doing today?"}</p>
      <div className="mt-4 text-sm">
        <p className="font-medium">Try questions like:</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-left max-w-md mx-auto">
          <li>"How did I feel about work last week?"</li>
          <li>"What are my top 3 emotions in my journal?"</li>
          <li>"When was I feeling most anxious and why?"</li>
          <li>"What's the sentiment trend in my journal?"</li>
          <li>"My top 3 positive and negative emotions?"</li>
        </ul>
      </div>
    </div>
  );
};

export default EmptyChatState;
