import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/use-theme';
import { InspirationalQuote } from '@/components/quotes/InspirationalQuote';
import EnergyAnimation from '@/components/EnergyAnimation';

const Home = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const navigate = useNavigate();
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  
  useEffect(() => {
    console.log('Home component mounted');
    
    setRefreshKey(prev => prev + 1);
    
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const localName = localStorage.getItem('user_display_name');
          
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, full_name')
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
          } else if (data && data.full_name) {
            setDisplayName(data.full_name);
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
  
  const getJournalName = () => {
    if (displayName) {
      return displayName.endsWith('s') ? `${displayName}' Journal` : `${displayName}'s Journal`;
    }
    if (user?.email) {
      const name = user.email.split('@')[0];
      return name.endsWith('s') ? `${name}' Journal` : `${name}'s Journal`;
    }
    return 'Your Journal';
  };

  const handleNavigateToJournal = () => {
    navigate('/journal');
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

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <EnergyAnimation fullScreen={true} bottomNavOffset={true} />
      
      <div className="relative z-10">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-theme">{getJournalName()}</h1>
          <p className="text-muted-foreground font-medium">{formattedDate}</p>
        </div>

        <motion.div
          className="px-4 py-8"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <Button 
              onClick={handleNavigateToJournal}
              className="w-full py-6 text-lg flex items-center justify-between relative z-10"
            >
              Start Journaling
              <ChevronRight />
            </Button>
          </motion.div>

          <motion.div variants={itemVariants} key={refreshKey} className="relative z-20">
            <InspirationalQuote />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
