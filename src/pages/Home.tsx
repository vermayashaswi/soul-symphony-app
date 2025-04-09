
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/use-theme';

const Home = () => {
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const today = new Date();
  const formattedDate = format(today, 'EEE, MMM d');
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const localName = localStorage.getItem('user_display_name');
          
          // Get profile data from Supabase
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, full_name')
            .eq('id', user.id)
            .single();
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching profile', error);
            return;
          }
          
          // Handle display name priority: local storage -> profile -> user metadata
          if (localName && (!data || !data.display_name)) {
            await updateDisplayName(localName);
            setDisplayName(localName);
            localStorage.removeItem('user_display_name');
          } else if (data && data.display_name) {
            setDisplayName(data.display_name);
          } else if (data && data.full_name) {
            setDisplayName(data.full_name);
          }
          
          // Handle avatar URL priority: profile -> user metadata
          if (data && data.avatar_url) {
            setAvatarUrl(data.avatar_url);
          } else if (user.user_metadata?.avatar_url) {
            setAvatarUrl(user.user_metadata.avatar_url);
          } else if (user.user_metadata?.picture) {
            setAvatarUrl(user.user_metadata.picture);
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

  const getBackgroundImage = () => {
    const images = {
      Default: '/placeholder.svg',
      Calm: 'https://images.unsplash.com/photo-1500673922987-e212871fec22',
      Soothing: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb',
      Energy: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      Focus: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9',
      Custom: 'https://images.unsplash.com/photo-1721322800607-8c38375eef04'
    };
    
    return images[colorTheme as keyof typeof images] || images.Calm;
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-6 flex items-center">
        <Avatar className="h-14 w-14 mr-4 border-2 border-theme">
          <AvatarImage src={avatarUrl || ''} alt={displayName || 'User'} />
          <AvatarFallback className="bg-theme-light text-theme-darker text-lg font-semibold">
            {displayName ? displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-3xl font-bold text-theme">{getJournalName()}</h1>
      </div>

      <motion.div
        className="px-4 py-8"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className="mb-12">
          <Card className="overflow-hidden rounded-xl max-w-md mx-auto">
            <div 
              className="h-64 w-full bg-cover bg-center" 
              style={{ backgroundImage: `url(${getBackgroundImage()})` }}
            />
            <div className="bg-gradient-to-b from-black/70 to-black/90 text-white p-6">
              <p className="text-gray-300 text-center mb-3">{formattedDate}</p>
              <h2 className="text-2xl font-bold text-center mb-6">
                Write about one good thing that happened yesterday.
              </h2>
              <div className="flex justify-center">
                <Button 
                  onClick={handleNavigateToJournal}
                  className="rounded-full h-14 w-14 p-0 bg-rose-500 hover:bg-rose-600"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;
