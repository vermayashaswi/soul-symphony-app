
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Mic, MessageSquare, LineChart, ArrowRight, TrendingUp } from 'lucide-react';
import SouloLogoSafe from '@/components/SouloLogoSafe';
import EmotionBubblesDemo from '@/components/website/EmotionBubblesDemo';
import SentimentChartDemo from '@/components/website/SentimentChartDemo';
import { TranslatableText } from '@/components/translation/TranslatableText';

export const PhoneVoiceAnimation = () => {
  const [animationStage, setAnimationStage] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const maxStages = 3;

  useEffect(() => {
    const generateWaveform = () => {
      const newWaveform = Array.from({ length: 16 }, () => 
        Math.random() * 0.8 + 0.2
      );
      setWaveform(newWaveform);
    };

    const interval = setInterval(() => {
      setAnimationStage((prev) => (prev + 1) % maxStages);
      
      if (animationStage === 0) {
        generateWaveform();
      }
    }, 3000);

    generateWaveform();

    return () => clearInterval(interval);
  }, [animationStage]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-full max-w-40 h-full max-h-72 md:max-w-44 md:max-h-80 bg-gray-900 rounded-[24px] md:rounded-[28px] overflow-hidden border-3 md:border-4 border-gray-800 shadow-xl">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 md:w-20 h-2.5 md:h-3 bg-black rounded-b-lg z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col">
          <div className="h-6 md:h-8 bg-gradient-to-r from-primary/80 to-purple-600/80 flex items-center justify-center">
            <SouloLogoSafe size="small" useColorTheme={true} disableTheme={true} />
          </div>
          <div className="flex-1 p-1.5 md:p-2 flex flex-col">
            {animationStage === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="text-white text-center mb-2 md:mb-3">
                  <span className="text-xs">
                    <TranslatableText text="Recording your journal..." />
                  </span>
                </div>
                <div className="w-full h-10 md:h-12 flex items-center justify-center gap-0.5 mb-3 md:mb-4">
                  {waveform.map((height, index) => (
                    <motion.div
                      key={index}
                      className="w-0.5 md:w-1 bg-primary rounded-full"
                      initial={{ height: 2 }}
                      animate={{ 
                        height: `${height * 40}px`,
                        opacity: height
                      }}
                      transition={{
                        duration: 0.2,
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: index * 0.02
                      }}
                    />
                  ))}
                </div>
                <motion.div 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-500 flex items-center justify-center mb-1 md:mb-2"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  <Mic className="h-4 w-4 md:h-5 md:w-5 text-white" />
                </motion.div>
              </motion.div>
            )}
            {animationStage === 1 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="text-white text-center mb-3 md:mb-4">
                  <span className="text-xs">
                    <TranslatableText text="Processing your entry..." />
                  </span>
                </div>
                <motion.div 
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-purple-600/30 flex items-center justify-center"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 360],
                    borderRadius: ["50%", "40%", "50%"]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Brain className="h-5 w-5 md:h-6 md:w-6 text-purple-400" />
                </motion.div>
                <div className="mt-3 md:mt-4 flex gap-1">
                  {[0, 0.3, 0.6].map((delay, index) => (
                    <motion.div 
                      key={index}
                      className="w-1.5 h-1.5 rounded-full bg-primary"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        repeatType: "loop",
                        delay
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            {animationStage === 2 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                <h3 className="text-white text-center mb-1.5 text-xs">
                  <TranslatableText text="Your Journal Insights" />
                </h3>
                
                {/* Enhanced Insights with Visualizations */}
                <div className="space-y-1">
                  {/* Emotions Visualization */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gray-800/80 p-1 md:p-1.5 rounded-md border border-gray-700"
                  >
                    <div className="flex items-center gap-1 md:gap-1.5 mb-0.5">
                      <div className="min-w-2.5 h-2.5 md:min-w-3 md:h-3 rounded-full bg-primary/20 flex items-center justify-center">
                        <LineChart className="h-1 w-1 md:h-1.5 md:w-1.5 text-primary" />
                      </div>
                      <p className="text-white text-xs">
                        <TranslatableText text="Emotional patterns" />
                      </p>
                    </div>
                    <div className="h-[25px] md:h-[30px] mt-0.5">
                      <EmotionBubblesDemo isPhonePreview={true} />
                    </div>
                  </motion.div>
                  
                  {/* Sentiment Chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gray-800/80 p-1 md:p-1.5 rounded-md border border-gray-700"
                  >
                    <div className="flex items-center gap-1 md:gap-1.5 mb-0.5">
                      <div className="min-w-2.5 h-2.5 md:min-w-3 md:h-3 rounded-full bg-primary/20 flex items-center justify-center">
                        <TrendingUp className="h-1 w-1 md:h-1.5 md:w-1.5 text-primary" />
                      </div>
                      <p className="text-white text-xs">
                        <TranslatableText text="Sentiment trending up" />
                      </p>
                    </div>
                    <div className="h-[25px] md:h-[30px] mt-0.5">
                      <SentimentChartDemo isPhonePreview={true} />
                    </div>
                  </motion.div>
                  
                  {/* Text Insight */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gray-800/80 p-1 md:p-1.5 rounded-md border border-gray-700"
                  >
                    <div className="flex gap-1 md:gap-1.5">
                      <div className="min-w-2.5 h-2.5 md:min-w-3 md:h-3 rounded-full bg-primary/20 flex items-center justify-center">
                        <LineChart className="h-1 w-1 md:h-1.5 md:w-1.5 text-primary" />
                      </div>
                      <p className="text-white text-xs">
                        <TranslatableText text="Sleep pattern improving since last week" />
                      </p>
                    </div>
                  </motion.div>
                </div>
                
                <motion.div 
                  className="mt-auto mb-1 md:mb-2 w-full bg-primary/20 p-1 md:p-1.5 rounded-md flex items-center justify-between"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <span className="text-primary text-xs">
                    <TranslatableText text="View full analysis" />
                  </span>
                  <ArrowRight className="h-2 w-2 md:h-2.5 md:w-2.5 text-primary" />
                </motion.div>
              </motion.div>
            )}
          </div>
          <div className="h-8 md:h-10 border-t border-gray-800 flex justify-around items-center px-1.5 md:px-2">
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-800 flex items-center justify-center">
              <Mic className="h-2.5 w-2.5 md:h-3 md:w-3 text-white" />
            </div>
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-800 flex items-center justify-center">
              <LineChart className="h-2.5 w-2.5 md:h-3 md:w-3 text-white" />
            </div>
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-800 flex items-center justify-center">
              <MessageSquare className="h-2.5 w-2.5 md:h-3 md:w-3 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
