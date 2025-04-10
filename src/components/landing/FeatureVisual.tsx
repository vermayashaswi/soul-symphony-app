
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Brain, LineChart, MessageSquare } from 'lucide-react';

interface VisualProps {
  type: 'voice' | 'ai' | 'chart' | 'chat';
}

const FeatureVisual: React.FC<VisualProps> = ({ type }) => {
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  const pulseVariants = {
    pulse: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity
      }
    }
  };

  const waveVariants = {
    wave: {
      y: [0, -10, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  useEffect(() => {
    if (type === 'chat') {
      const animationCycle = () => {
        setTypingText("");
        setShowResponse(false);
        
        setTimeout(() => {
          setIsTyping(true);
        }, 1500);
      };
      
      animationCycle();
      
      const intervalId = setInterval(animationCycle, 8000);
      
      return () => clearInterval(intervalId);
    }
  }, [type]);

  useEffect(() => {
    if (isTyping) {
      const text = "How have I been feeling lately?";
      let currentIndex = 0;
      
      const typingInterval = setInterval(() => {
        if (currentIndex <= text.length) {
          setTypingText(text.substring(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          
          setTimeout(() => {
            setShowResponse(true);
          }, 800);
        }
      }, 100);
      
      return () => clearInterval(typingInterval);
    }
  }, [isTyping]);

  switch (type) {
    case 'voice':
      return (
        <motion.div 
          className="relative flex items-center justify-center p-4 bg-primary/10 rounded-full"
          variants={pulseVariants}
          animate="pulse"
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/5"
            variants={pulseVariants}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 0.1, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <Mic className="h-12 w-12 text-primary" />
        </motion.div>
      );
    case 'ai':
      return (
        <motion.div 
          className="flex flex-wrap gap-2 justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {['Happiness', 'Growth', 'Stress', 'Family', 'Work', 'Health'].map((theme, index) => (
            <motion.div
              key={theme}
              className="px-3 py-1 bg-primary/20 rounded-full text-sm font-medium text-primary"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                y: [0, index % 2 === 0 ? -5 : 5, 0]
              }}
              transition={{ 
                delay: index * 0.1 + 0.5,
                y: {
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: index * 0.2
                }
              }}
            >
              {theme}
            </motion.div>
          ))}
        </motion.div>
      );
    case 'chart':
      return (
        <motion.div 
          className="relative h-32 w-full bg-background/80 rounded-lg overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <svg viewBox="0 0 500 100" className="w-full h-full">
            {[0, 25, 50, 75, 100].map((line) => (
              <motion.line
                key={`grid-${line}`}
                x1="0"
                y1={line}
                x2="500"
                y2={line}
                stroke="hsl(var(--muted))"
                strokeWidth="0.5"
                strokeDasharray="5,5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 0.8, duration: 1 }}
              />
            ))}
            
            <motion.path
              d="M0,80 C50,70 100,60 150,40 C200,20 250,10 300,15 C350,20 400,10 500,5"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 3, delay: 0.5 }}
            />
            
            {[
              { x: 50, y: 70, delay: 1.0 },
              { x: 150, y: 40, delay: 1.5 },
              { x: 300, y: 15, delay: 2.0 },
              { x: 450, y: 5, delay: 2.5 }
            ].map((point, i) => (
              <motion.circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="hsl(var(--primary))"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: point.delay }}
              />
            ))}
            
            <motion.text
              x="450"
              y="20"
              fontSize="12"
              fill="hsl(var(--primary))"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3 }}
            >
              Joy +95%
            </motion.text>
            
            <motion.text
              x="10"
              y="95"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 3.2 }}
            >
              Jan
            </motion.text>
            <motion.text
              x="480"
              y="95"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 3.4 }}
            >
              Now
            </motion.text>
          </svg>
        </motion.div>
      );
    case 'chat':
      return (
        <motion.div 
          className="flex flex-col gap-2 min-h-[120px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <motion.div 
            className="self-start max-w-[80%] bg-muted p-2 rounded-lg text-xs text-left"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {typingText}
            {isTyping && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block"
              >
                |
              </motion.span>
            )}
          </motion.div>
          
          {showResponse && (
            <motion.div 
              className="self-end max-w-[80%] bg-primary text-primary-foreground p-2 rounded-lg text-xs text-left"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.05 }}
              >
                Based on your recent entries, you've been feeling more positive and energetic this week...
              </motion.span>
            </motion.div>
          )}
        </motion.div>
      );
    default:
      return null;
  }
};

export default FeatureVisual;
