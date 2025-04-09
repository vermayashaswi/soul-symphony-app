
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
        setWeather(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        setWeather(prev => ({ ...prev, loading: true, error: null }));
        console.log('Fetching weather for:', latitude, longitude);
        
        // Fetch weather data from OpenWeatherMap API
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${WEATHER_API_KEY}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Weather API error response:', errorText);
          throw new Error(`Weather data not available: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Weather API response data:', data);
        
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

        const mappedCondition = mapCondition(data.weather[0].id);
        console.log('Mapped weather condition:', mappedCondition);
        console.log('Temperature from API:', data.main.temp);

        setWeather({
          temperature: Math.round(data.main.temp),
          description: data.weather[0].description,
          condition: mappedCondition,
          location: data.name,
          humidity: data.main.humidity,
          windSpeed: data.wind.speed,
          date: new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          loading: false,
          error: null
        });
        
        console.log('Weather data processed successfully');
      } catch (error) {
        console.error('Error fetching weather:', error);
        setWeather(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch weather data'
        }));
        toast.error('Could not load weather information');
      }
    };

    fetchWeather();
  }, [latitude, longitude]);

  return weather;
};
