
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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

const WEATHER_API_KEY = 'e1d0f85021c61bff4fc7262770e11ae5'; // Free OpenWeatherMap API key for demo purposes

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
        
        // Construct API URL with proper formatting to avoid any potential issues
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude.toFixed(6)}&lon=${longitude.toFixed(6)}&units=metric&appid=${WEATHER_API_KEY}`;
        console.log('Weather API URL:', apiUrl);
        
        // Fetch weather data from OpenWeatherMap API
        const response = await fetch(apiUrl);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Weather API error response:', errorText);
          throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Weather API response data:', data);
        
        if (!data || !data.main || !data.weather || !data.weather[0]) {
          console.error('Incomplete weather data received:', data);
          throw new Error('Incomplete weather data received from API');
        }
        
        // Map weather condition codes to our condition types
        const mapCondition = (weatherId: number): WeatherData['condition'] => {
          if (weatherId >= 200 && weatherId < 300) return 'thunderstorm';
          if (weatherId >= 300 && weatherId < 600) return 'rain';
          if (weatherId >= 600 && weatherId < 700) return 'snow';
          if (weatherId >= 700 && weatherId < 800) return 'mist';
          if (weatherId === 800) return 'clear';
          if (weatherId > 800) return 'clouds';
          return 'unknown';
        };

        const mainTemp = data.main.temp;
        if (typeof mainTemp !== 'number') {
          console.error('Invalid temperature data:', mainTemp);
          throw new Error('Invalid temperature data received');
        }

        const mappedCondition = mapCondition(data.weather[0].id);
        console.log('Mapped weather condition:', mappedCondition);
        console.log('Temperature from API:', mainTemp);

        setWeather({
          temperature: Math.round(mainTemp),
          description: data.weather[0].description,
          condition: mappedCondition,
          location: data.name || 'Unknown location',
          humidity: data.main.humidity || 0,
          windSpeed: data.wind.speed || 0,
          date: new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          loading: false,
          error: null
        });
        
        console.log('Weather data processed successfully:', {
          temperature: Math.round(mainTemp),
          location: data.name,
          condition: mappedCondition
        });
        
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
