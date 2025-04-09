import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/use-theme';
import { InspirationalQuote } from '@/components/quotes/InspirationalQuote';

const Home = () => {
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
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
    setBackgroundImage(getRandomBackgroundImage());
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

  const getRandomBackgroundImage = () => {
    const images = [
      'https://images.unsplash.com/photo-1500673922987-e212871fec22',
      'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9',
      'https://images.unsplash.com/photo-1682686580391-615b1f28e5ee',
      'https://images.unsplash.com/photo-1682685797208-c741d58c2eff',
      'https://images.unsplash.com/photo-1613336026275-d6d473084e85',
      'https://images.unsplash.com/photo-1531604250646-2f0e818c4f06'
    ];
    
    return images[Math.floor(Math.random() * images.length)];
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

  console.log('Rendering Home page with background image:', backgroundImage);

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <Card className="overflow-hidden rounded-xl max-w-md mx-auto">
            <div 
              className="h-64 w-full bg-cover bg-center cursor-pointer"
              style={{ backgroundImage: `url(${backgroundImage || '/placeholder.svg'})` }}
              onClick={handleNavigateToJournal}
            />
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} key={refreshKey}>
          <InspirationalQuote />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;
