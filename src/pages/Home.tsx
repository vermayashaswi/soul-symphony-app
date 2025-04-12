
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/use-theme';
import { InspirationalQuote } from '@/components/quotes/InspirationalQuote';
import EnergyAnimation from '@/components/EnergyAnimation';
import JournalSummaryCard from '@/components/home/JournalSummaryCard';

const Home = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  
  useEffect(() => {
    const preloadImage = new Image();
    preloadImage.src = '/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png';
  }, []);
  
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
      
      <div className="hidden">
        <img 
          src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png" 
          alt="Preload Ruh's avatar" 
          width="1" 
          height="1"
        />
      </div>
      
      <div className="relative z-10 flex flex-col h-screen">
        <div className="p-4 flex flex-col">
          <h1 className="text-2xl font-bold text-theme">{getJournalName()}</h1>
          <p className="text-xs text-muted-foreground">Your last 7 days</p>
          <div className="ml-auto text-muted-foreground font-medium">{formattedDate}</div>
        </div>

        <div className="flex-1 px-0">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="h-full w-full"
          >
            <motion.div 
              variants={itemVariants}
              className="h-full w-full"
            >
              <div className="w-full h-full">
                <JournalSummaryCard />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
      
      <InspirationalQuote />
    </div>
  );
};

export default Home;
