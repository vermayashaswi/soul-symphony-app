
import { useState, useEffect } from 'react';

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
      if (latitude === null || longitude === null) {
        setWeather(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        setWeather(prev => ({ ...prev, loading: true, error: null }));
        
        // Fetch weather data from OpenWeatherMap API
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${WEATHER_API_KEY}`
        );

        if (!response.ok) {
          throw new Error('Weather data not available');
        }

        const data = await response.json();
        
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

        setWeather({
          temperature: Math.round(data.main.temp),
          description: data.weather[0].description,
          condition: mapCondition(data.weather[0].id),
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
      } catch (error) {
        console.error('Error fetching weather:', error);
        setWeather(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch weather data'
        }));
      }
    };

    fetchWeather();
  }, [latitude, longitude]);

  return weather;
};
