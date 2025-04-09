
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Home = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          // First check if there's a name stored from onboarding
          const localName = localStorage.getItem('user_display_name');
          
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .single();
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile', error);
            return;
          }
          
          // If we have a stored name from onboarding and no display name in profile yet,
          // update the profile with the stored name
          if (localName && (!data || !data.display_name)) {
            await updateDisplayName(localName);
            setDisplayName(localName);
            // Remove from localStorage to avoid overwriting future updates
            localStorage.removeItem('user_display_name');
          } else if (data && data.display_name) {
            setDisplayName(data.display_name);
          }
        } catch (error) {
          console.error('Error in profile fetching', error);
        }
      }
    };
    
    fetchUserProfile();
  }, [user]);
  
  const updateDisplayName = async (name: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating display name', error);
    }
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  // Get the greeting name with priority: display name > email username > "Friend"
  const getGreetingName = () => {
    if (displayName) return displayName;
    if (user?.email) return user.email.split('@')[0];
    return 'Friend';
  };

  return (
    <div className="min-h-screen pt-6 pb-20 px-4">
      <motion.div
        className="max-w-md mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className="mb-6">
          <h1 className="text-2xl font-bold text-theme">
            Welcome, {getGreetingName()}!
          </h1>
          <p className="text-muted-foreground mt-2">
            Your personal wellness journey continues here
          </p>
        </motion.div>
        
        <motion.div 
          variants={itemVariants}
          className="bg-gradient-to-br from-theme/10 to-theme/5 rounded-xl p-5 mb-6 shadow-sm"
        >
          <h2 className="font-semibold text-lg mb-3">Your Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Track your progress, revisit your journal entries, and discover new insights about yourself.
          </p>
        </motion.div>
        
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-card rounded-lg p-4 shadow-sm border border-border">
            <h3 className="font-medium">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <a href="/journal" className="bg-background hover:bg-accent transition-colors rounded-md p-3 text-center text-sm">
                New Journal Entry
              </a>
              <a href="/smart-chat" className="bg-background hover:bg-accent transition-colors rounded-md p-3 text-center text-sm">
                Chat with SOuLO
              </a>
              <a href="/insights" className="bg-background hover:bg-accent transition-colors rounded-md p-3 text-center text-sm">
                View Insights
              </a>
              <a href="/settings" className="bg-background hover:bg-accent transition-colors rounded-md p-3 text-center text-sm">
                Settings
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;
