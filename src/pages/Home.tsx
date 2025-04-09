
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLocation } from '@/hooks/use-location';
import { useWeather } from '@/hooks/use-weather';
import { WeatherCard } from '@/components/weather/WeatherCard';
import { LocationPermission } from '@/components/weather/LocationPermission';
import { Loader2 } from 'lucide-react';

const Home = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = React.useState<string | null>(null);
  
  React.useEffect(() => {
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

  // Get location and weather data
  const { 
    latitude, 
    longitude, 
    loading: locationLoading, 
    error: locationError,
    permissionState,
    requestLocationPermission
  } = useLocation();
  
  const weather = useWeather(latitude, longitude);

  console.log('Location status:', { 
    latitude, 
    longitude, 
    locationLoading, 
    locationError,
    permissionState 
  });
  
  console.log('Weather status:', { 
    condition: weather.condition,
    location: weather.location,
    loading: weather.loading,
    error: weather.error
  });

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
        
        <motion.div variants={itemVariants} className="space-y-4">
          {locationLoading ? (
            <div className="bg-gradient-to-br from-theme/10 to-theme/5 rounded-xl p-8 flex flex-col items-center justify-center h-96">
              <Loader2 className="h-10 w-10 text-theme animate-spin mb-4" />
              <p className="text-foreground">Determining your location...</p>
            </div>
          ) : weather.loading ? (
            <div className="bg-gradient-to-br from-theme/10 to-theme/5 rounded-xl p-8 flex flex-col items-center justify-center h-96">
              <Loader2 className="h-10 w-10 text-theme animate-spin mb-4" />
              <p className="text-foreground">Loading weather information...</p>
            </div>
          ) : permissionState !== 'granted' || locationError ? (
            <LocationPermission 
              onRequestPermission={requestLocationPermission} 
              permissionState={permissionState}
              error={locationError}
            />
          ) : (
            <WeatherCard weather={weather} />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;
