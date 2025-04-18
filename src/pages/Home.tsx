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
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';

const Home = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { colorTheme, theme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  const navigate = useNavigate();
  
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

  const dateStripVariants = {
    hidden: { x: 100, opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
  };
  
  const navigateToJournal = () => {
    try {
      navigate('/app/journal');
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div className="absolute inset-0 z-0">
        <EnergyAnimation fullScreen={true} bottomNavOffset={true} />
      </div>
      
      <div className="hidden">
        <img 
          src="/lovable-uploads/3f275134-f471-4af9-a7cd-700ccd855fe3.png" 
          alt="Preload Ruh's avatar" 
          width="1" 
          height="1"
        />
      </div>
      
      <div className="relative z-20 flex flex-col h-screen">
        <div className="p-4 flex flex-col">
          <div className="flex justify-between items-start w-full relative">
            <div className="relative">
              <h1 
                className="text-2xl font-bold text-theme" 
                style={{ 
                  fontWeight: 700,
                  letterSpacing: '0.005em',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}
              >
                {getJournalName()}
              </h1>
            </div>
            
            <motion.div 
              variants={dateStripVariants}
              initial="hidden"
              animate="visible"
              className={`px-3 py-1 rounded-l-md whitespace-nowrap ${theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-100/80'}`}
            >
              <div 
                className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                style={{ 
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}
              >
                {formattedDate}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Arrow button with glowing effect - always visible for all users */}
      <div className="absolute top-[calc(50%-31px)] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/30 blur-md z-0"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{ 
            repeat: Infinity,
            duration: 2,
            ease: "easeInOut"
          }}
          style={{ 
            width: "calc(100% + 16px)", 
            height: "calc(100% + 16px)", 
            top: "-8px", 
            left: "-8px" 
          }}
        />
        <motion.button
          onClick={navigateToJournal}
          className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg relative z-20"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <ArrowRight className="text-primary-foreground h-6 w-6" />
        </motion.button>
      </div>
      
      <div className="flex-1 px-0 absolute inset-0 z-30">
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
      
      <div className="fixed inset-x-0 bottom-16 pb-5 z-25">
        <InspirationalQuote />
      </div>
    </div>
  );
};

export default Home;
