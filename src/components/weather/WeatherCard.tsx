
import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Thermometer, Droplets, Wind, Calendar } from 'lucide-react';
import { WeatherAnimation } from './WeatherAnimation';
import { WeatherData } from '@/hooks/use-weather';
import { cn } from '@/lib/utils';

interface WeatherCardProps {
  weather: WeatherData;
  className?: string;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather, className }) => {
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      className={cn("bg-gradient-to-br from-theme/10 to-theme/5 rounded-xl p-6 shadow-sm w-full", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="flex flex-col h-full" variants={containerVariants}>
        <motion.div variants={itemVariants} className="mb-4">
          <div className="flex items-center">
            <MapPin className="h-5 w-5 text-theme mr-2" />
            <h2 className="font-semibold text-lg">{weather.location}</h2>
          </div>
          <div className="flex items-center mt-1 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 mr-1" />
            <span>{weather.date}</span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="flex-1 flex flex-col items-center">
          <div className="h-40 w-full mb-4">
            <WeatherAnimation condition={weather.condition} />
          </div>
          
          <h3 className="text-3xl font-bold text-center mb-1">{weather.temperature}°C</h3>
          <p className="text-muted-foreground capitalize mb-4">{weather.description}</p>
          
          <div className="grid grid-cols-2 gap-4 w-full">
            <motion.div variants={itemVariants} className="flex items-center">
              <div className="rounded-full bg-theme/10 p-2 mr-3">
                <Droplets className="h-5 w-5 text-theme" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Humidity</div>
                <div className="font-medium">{weather.humidity}%</div>
              </div>
            </motion.div>
            
            <motion.div variants={itemVariants} className="flex items-center">
              <div className="rounded-full bg-theme/10 p-2 mr-3">
                <Wind className="h-5 w-5 text-theme" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Wind</div>
                <div className="font-medium">{weather.windSpeed} m/s</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
