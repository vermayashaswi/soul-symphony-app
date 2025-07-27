
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type WeatherData = {
  temperature: number;
  description: string;
  condition: 'clear' | 'rain' | 'clouds' | 'snow' | 'mist' | 'thunderstorm' | 'unknown';
  location: string;
  humidity: number;
  windSpeed: number;
  date: string;
  loading: boolean;
  error: string | null;
};

// API key is now securely stored in Supabase secrets and accessed via edge function

export const useWeather = (latitude: number | null, longitude: number | null) => {
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    description: '',
    condition: 'unknown',
    location: '',
    humidity: 0,
    windSpeed: 0,
    date: new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchWeather = async () => {
      // Skip if location data isn't available
      if (latitude === null || longitude === null) {
        console.log('Location data is null, skipping weather fetch');
        setWeather(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        setWeather(prev => ({ ...prev, loading: true, error: null }));
        console.log('Fetching weather for coordinates:', latitude, longitude);
        
        // Use secure edge function to fetch weather data
        const { data, error } = await supabase.functions.invoke('weather-api', {
          body: { latitude, longitude }
        });

        if (error) {
          console.error('Weather edge function error:', error);
          throw new Error(error.message || 'Failed to fetch weather data');
        }

        if (!data.success) {
          console.error('Weather API error:', data.error);
          throw new Error(data.error || 'Weather service error');
        }

        console.log('Weather data received successfully');
        
        setWeather(data.data);
        
        // Show success toast
        toast.success('Weather information updated');
      } catch (error) {
        console.error('Error fetching weather:', error);
        
        // Set detailed error information
        setWeather(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch weather data'
        }));
        
        // Show error toast with more specific message
        toast.error('Could not load weather information');
        
        // After 5 seconds, retry fetching weather data
        setTimeout(() => {
          console.log('Retrying weather fetch...');
          setWeather(prev => ({ ...prev, loading: true, error: null }));
        }, 5000);
      }
    };

    fetchWeather();
    
    // Set up polling to refresh weather data every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [latitude, longitude]);

  return weather;
};
