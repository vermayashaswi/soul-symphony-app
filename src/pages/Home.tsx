
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const Home = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
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
          
          if (localName && (!data || !data.display_name)) {
            await updateDisplayName(localName);
            setDisplayName(localName);
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
      </motion.div>
    </div>
  );
};

export default Home;
