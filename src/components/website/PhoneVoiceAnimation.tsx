
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Mic, MessageSquare, LineChart, ArrowRight, TrendingUp } from 'lucide-react';
import SouloLogo from '@/components/SouloLogo';
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
      <div className="relative w-full max-w-48 h-full max-h-80 md:max-w-52 md:max-h-96 lg:max-w-56 lg:max-h-[420px] xl:max-w-60 xl:max-h-[480px] bg-gray-900 rounded-[28px] md:rounded-[32px] lg:rounded-[36px] overflow-hidden border-3 md:border-4 lg:border-[5px] border-gray-800 shadow-xl">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 md:w-24 lg:w-28 h-3 md:h-3.5 lg:h-4 bg-black rounded-b-lg z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col">
          <div className="h-8 md:h-10 lg:h-12 bg-gradient-to-r from-primary/80 to-purple-600/80 flex items-center justify-center">
            <SouloLogo size="small" useColorTheme={true} />
          </div>
          <div className="flex-1 p-2 md:p-2.5 lg:p-3 flex flex-col">
            {animationStage === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="text-white text-center mb-3 md:mb-4 lg:mb-5">
                  <span className="text-xs md:text-sm">
                    <TranslatableText text="Recording your journal..." />
                  </span>
                </div>
                <div className="w-full h-12 md:h-16 lg:h-20 flex items-center justify-center gap-0.5 mb-4 md:mb-5 lg:mb-6">
                  {waveform.map((height, index) => (
                    <motion.div
                      key={index}
                      className="w-0.5 md:w-1 lg:w-1.5 bg-primary rounded-full"
                      initial={{ height: 2 }}
                      animate={{ 
                        height: `${height * (window.innerWidth >= 1024 ? 60 : window.innerWidth >= 768 ? 50 : 40)}px`,
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
                  className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-red-500 flex items-center justify-center mb-2 md:mb-3"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  <Mic className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-white" />
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
                <div className="text-white text-center mb-4 md:mb-5 lg:mb-6">
                  <span className="text-xs md:text-sm">
                    <TranslatableText text="Processing your entry..." />
                  </span>
                </div>
                <motion.div 
                  className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full bg-purple-600/30 flex items-center justify-center"
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
                  <Brain className="h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10 text-purple-400" />
                </motion.div>
                <div className="mt-4 md:mt-5 lg:mt-6 flex gap-1.5">
                  {[0, 0.3, 0.6].map((delay, index) => (
                    <motion.div 
                      key={index}
                      className="w-2 h-2 md:w-2.5 md:h-2.5 lg:w-3 lg:h-3 rounded-full bg-primary"
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
                <h3 className="text-white text-center mb-2 md:mb-2.5 lg:mb-3 text-xs md:text-sm">
                  <TranslatableText text="Your Journal Insights" />
                </h3>
                
                {/* Enhanced Insights with Visualizations */}
                <div className="space-y-1.5 md:space-y-2 lg:space-y-2.5">
                  {/* Emotions Visualization */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gray-800/80 p-1.5 md:p-2 lg:p-2.5 rounded-md border border-gray-700"
                  >
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1">
                      <div className="min-w-3 h-3 md:min-w-3.5 md:h-3.5 lg:min-w-4 lg:h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <LineChart className="h-1.5 w-1.5 md:h-2 md:w-2 lg:h-2.5 lg:w-2.5 text-primary" />
                      </div>
                      <p className="text-white text-xs">
                        <TranslatableText text="Emotional patterns" />
                      </p>
                    </div>
                    <div className="h-[30px] md:h-[35px] lg:h-[40px] mt-1">
                      <EmotionBubblesDemo isPhonePreview={true} />
                    </div>
                  </motion.div>
                  
                  {/* Sentiment Chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gray-800/80 p-1.5 md:p-2 lg:p-2.5 rounded-md border border-gray-700"
                  >
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1">
                      <div className="min-w-3 h-3 md:min-w-3.5 md:h-3.5 lg:min-w-4 lg:h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <TrendingUp className="h-1.5 w-1.5 md:h-2 md:w-2 lg:h-2.5 lg:w-2.5 text-primary" />
                      </div>
                      <p className="text-white text-xs">
                        <TranslatableText text="Sentiment trending up" />
                      </p>
                    </div>
                    <div className="h-[30px] md:h-[35px] lg:h-[40px] mt-1">
                      <SentimentChartDemo isPhonePreview={true} />
                    </div>
                  </motion.div>
                  
                  {/* Text Insight */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gray-800/80 p-1.5 md:p-2 lg:p-2.5 rounded-md border border-gray-700"
                  >
                    <div className="flex gap-1.5 md:gap-2">
                      <div className="min-w-3 h-3 md:min-w-3.5 md:h-3.5 lg:min-w-4 lg:h-4 rounded-full bg-primary/20 flex items-center justify-center">
                        <LineChart className="h-1.5 w-1.5 md:h-2 md:w-2 lg:h-2.5 lg:w-2.5 text-primary" />
                      </div>
                      <p className="text-white text-xs">
                        <TranslatableText text="Sleep pattern improving since last week" />
                      </p>
                    </div>
                  </motion.div>
                </div>
                
                <motion.div 
                  className="mt-auto mb-2 md:mb-3 lg:mb-4 w-full bg-primary/20 p-1.5 md:p-2 lg:p-2.5 rounded-md flex items-center justify-between"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <span className="text-primary text-xs">
                    <TranslatableText text="View full analysis" />
                  </span>
                  <ArrowRight className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 text-primary" />
                </motion.div>
              </motion.div>
            )}
          </div>
          <div className="h-10 md:h-12 lg:h-14 border-t border-gray-800 flex justify-around items-center px-2 md:px-3 lg:px-4">
            <div className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 rounded-full bg-gray-800 flex items-center justify-center">
              <Mic className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 text-white" />
            </div>
            <div className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 rounded-full bg-gray-800 flex items-center justify-center">
              <LineChart className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 text-white" />
            </div>
            <div className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 rounded-full bg-gray-800 flex items-center justify-center">
              <MessageSquare className="h-3 w-3 md:h-3.5 md:w-3.5 lg:h-4 lg:w-4 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
