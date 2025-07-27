import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { latitude, longitude } = await req.json();
    
    if (!latitude || !longitude) {
      throw new Error('Missing required parameters: latitude and longitude');
    }

    // Get API key from environment variables (Supabase secrets)
    const WEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY');
    
    if (!WEATHER_API_KEY) {
      console.error('OPENWEATHER_API_KEY not configured in Supabase secrets');
      throw new Error('Weather service not configured');
    }

    console.log('Fetching weather for coordinates:', latitude, longitude);
    
    // Construct API URL with proper formatting
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${Number(latitude).toFixed(6)}&lon=${Number(longitude).toFixed(6)}&units=metric&appid=${WEATHER_API_KEY}`;
    
    // Fetch weather data from OpenWeatherMap API
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Weather API error response:', errorText);
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Weather API response received successfully');
    
    if (!data || !data.main || !data.weather || !data.weather[0]) {
      console.error('Incomplete weather data received:', data);
      throw new Error('Incomplete weather data received from API');
    }
    
    // Map weather condition codes to our condition types
    const mapCondition = (weatherId: number): string => {
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

    const weatherData = {
      temperature: Math.round(mainTemp),
      description: data.weather[0].description,
      condition: mapCondition(data.weather[0].id),
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
    };
    
    console.log('Weather data processed successfully:', {
      temperature: weatherData.temperature,
      location: weatherData.location,
      condition: weatherData.condition
    });
    
    return new Response(
      JSON.stringify({ 
        success: true,
        data: weatherData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error("Error in weather-api function:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to fetch weather data'
      }),
      {
        status: 200, // Using 200 to avoid CORS issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});