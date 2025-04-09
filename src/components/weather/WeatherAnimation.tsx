
import React from 'react';
import { motion } from 'framer-motion';
import { CloudSun, CloudRain, Cloud, CloudSnow, CloudFog, CloudLightning } from 'lucide-react';
import { WeatherData } from '@/hooks/use-weather';

interface WeatherAnimationProps {
  condition: WeatherData['condition'];
  className?: string;
}

export const WeatherAnimation: React.FC<WeatherAnimationProps> = ({ condition, className }) => {
  const renderAnimation = () => {
    switch (condition) {
      case 'clear':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
              className="absolute w-20 h-20 bg-yellow-300 rounded-full"
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.9, 1, 0.9],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="relative z-10"
              animate={{
                rotate: [0, 360]
              }}
              transition={{
                duration: 150,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <CloudSun className="h-24 w-24 text-yellow-400 drop-shadow-md" />
            </motion.div>
          </div>
        );
        
      case 'rain':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div className="relative mb-10">
              <Cloud className="h-24 w-24 text-gray-400" />
              
              <div className="absolute top-full left-0 w-full h-20 overflow-hidden">
                {[...Array(12)].map((_, idx) => (
                  <motion.div
                    key={idx}
                    className="absolute top-0 bg-blue-400 rounded-full w-1 h-6"
                    style={{
                      left: `${(idx * 8) + Math.random() * 5}%`,
                    }}
                    animate={{
                      y: [0, 80],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: idx * 0.1,
                      ease: "easeIn"
                    }}
                  />
                ))}
              </div>
            </motion.div>
            <CloudRain className="absolute h-24 w-24 text-blue-400 opacity-70" />
          </div>
        );
        
      case 'clouds':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
              className="absolute"
              animate={{
                x: [-10, 10, -10]
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Cloud className="h-16 w-16 text-gray-400" />
            </motion.div>
            
            <motion.div
              className="absolute transform translate-x-8 translate-y-8"
              animate={{
                x: [5, -5, 5]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            >
              <Cloud className="h-20 w-20 text-gray-500" />
            </motion.div>
            
            <motion.div
              className="absolute transform -translate-x-10 translate-y-4"
              animate={{
                x: [8, -8, 8]
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2
              }}
            >
              <Cloud className="h-18 w-18 text-gray-300" />
            </motion.div>
          </div>
        );
        
      case 'snow':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <CloudSnow className="h-24 w-24 text-blue-100" />
            
            <div className="absolute top-1/2 left-0 w-full h-32 overflow-hidden">
              {[...Array(20)].map((_, idx) => (
                <motion.div
                  key={idx}
                  className="absolute top-0 bg-white rounded-full"
                  style={{
                    width: Math.random() * 6 + 3,
                    height: Math.random() * 6 + 3,
                    left: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, 100],
                    x: [0, Math.random() * 20 - 10],
                    rotate: [0, 360],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: idx * 0.2,
                    ease: "linear"
                  }}
                />
              ))}
            </div>
          </div>
        );
        
      case 'mist':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <CloudFog className="h-24 w-24 text-gray-300" />
            
            {[...Array(3)].map((_, idx) => (
              <motion.div
                key={idx}
                className="absolute bg-gray-200 rounded-full opacity-50"
                style={{
                  width: 100 + idx * 30,
                  height: 10 + idx * 2,
                  top: `${40 + idx * 20}%`,
                }}
                animate={{
                  x: [50, -50, 50],
                  opacity: [0.2, 0.5, 0.2]
                }}
                transition={{
                  duration: 6 + idx,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: idx * 0.3
                }}
              />
            ))}
          </div>
        );
        
      case 'thunderstorm':
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div className="relative">
              <Cloud className="h-24 w-24 text-gray-700" />
              
              <motion.div 
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2"
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.8, 1.1, 0.8]
                }}
                transition={{
                  duration: 0.3,
                  repeat: Infinity,
                  repeatDelay: 2.5,
                  ease: "easeOut"
                }}
              >
                <CloudLightning className="h-28 w-28 text-yellow-400" />
              </motion.div>
              
              <div className="absolute top-full left-0 w-full h-20 overflow-hidden">
                {[...Array(8)].map((_, idx) => (
                  <motion.div
                    key={idx}
                    className="absolute top-0 bg-blue-400 rounded-full w-1 h-5"
                    style={{
                      left: `${(idx * 12) + Math.random() * 5}%`,
                    }}
                    animate={{
                      y: [0, 60],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: idx * 0.1,
                      repeatDelay: 1,
                      ease: "easeIn"
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        );
        
      case 'unknown':
      default:
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
              animate={{
                rotate: [0, 10, 0, -10, 0]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Cloud className="h-24 w-24 text-gray-400" />
            </motion.div>
          </div>
        );
    }
  };

  return (
    <div className={`w-full h-full flex items-center justify-center ${className || ''}`}>
      {renderAnimation()}
    </div>
  );
};
