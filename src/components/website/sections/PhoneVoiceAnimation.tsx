import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Mic, MessageSquare, LineChart, ArrowRight, TrendingUp } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import SouloLogo from '@/components/SouloLogo';
import EmotionBubblesDemo from '@/components/website/EmotionBubblesDemo';
import SentimentChartDemo from '@/components/website/SentimentChartDemo';

const PhoneVoiceAnimation = () => {
  const [animationStage, setAnimationStage] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const maxStages = 3;

  useEffect(() => {
    const generateWaveform = () => {
      const newWaveform = Array.from({ length: 30 }, () => 
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
      <div className="relative w-64 h-[500px] bg-gray-900 rounded-[40px] overflow-hidden border-8 border-gray-800 shadow-xl">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col">
          <div className="h-14 bg-gradient-to-r from-primary/80 to-purple-600/80 flex items-center justify-center">
            <SouloLogo size="small" useColorTheme={true} />
          </div>
          <div className="flex-1 p-4 flex flex-col">
            {animationStage === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="text-white text-center mb-6">
                  <TranslatableText text="Recording your journal..." className="text-sm mb-2" />
                </div>
                <div className="w-full h-24 flex items-center justify-center gap-1 mb-8">
                  {waveform.map((height, index) => (
                    <motion.div
                      key={index}
                      className="w-1.5 bg-primary rounded-full"
                      initial={{ height: 4 }}
                      animate={{ 
                        height: `${height * 80}px`,
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
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-4"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  <Mic className="h-8 w-8 text-white" />
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
                <div className="text-white text-center mb-8">
                  <TranslatableText text="Processing your entry..." className="text-sm mb-2" />
                </div>
                <motion.div 
                  className="w-20 h-20 rounded-full bg-purple-600/30 flex items-center justify-center"
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
                  <Brain className="h-10 w-10 text-purple-400" />
                </motion.div>
                <div className="mt-8 flex gap-2">
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: 0
                    }}
                  />
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: 0.3
                    }}
                  />
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: 0.6
                    }}
                  />
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
                <h3 className="text-white text-center mb-3 text-sm"><TranslatableText text="Your Journal Insights" /></h3>
                
                {/* Enhanced Insights with Visualizations */}
                <div className="space-y-3">
                  {/* Emotions Visualization */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gray-800/80 p-3 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="min-w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <LineChart className="h-3 w-3 text-primary" />
                      </div>
                      <p className="text-white text-xs">Emotional patterns</p>
                    </div>
                    <div className="h-[60px] mt-2">
                      <EmotionBubblesDemo isPhonePreview={true} />
                    </div>
                  </motion.div>
                  
                  {/* Sentiment Chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gray-800/80 p-3 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="min-w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <TrendingUp className="h-3 w-3 text-primary" />
                      </div>
                      <p className="text-white text-xs">Sentiment trending up</p>
                    </div>
                    <div className="h-[60px] mt-1">
                      <SentimentChartDemo isPhonePreview={true} />
                    </div>
                  </motion.div>
                  
                  {/* Text Insight */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gray-800/80 p-3 rounded-lg border border-gray-700"
                  >
                    <div className="flex gap-2">
                      <div className="min-w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <LineChart className="h-3 w-3 text-primary" />
                      </div>
                      <p className="text-white text-xs">Sleep pattern improving since last week</p>
                    </div>
                  </motion.div>
                </div>
                
                <motion.div 
                  className="mt-auto mb-4 w-full bg-primary/20 p-3 rounded-lg flex items-center justify-between"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <TranslatableText text="View full analysis" className="text-primary text-xs" />
                  <ArrowRight className="h-4 w-4 text-primary" />
                </motion.div>
              </motion.div>
            )}
          </div>
          <div className="h-16 border-t border-gray-800 flex justify-around items-center px-4">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <LineChart className="h-5 w-5 text-white" />
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneVoiceAnimation;
