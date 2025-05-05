
import React from 'react';
import { motion } from 'framer-motion';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface SentimentChartDemoProps {
  isPhonePreview?: boolean;
}

const SentimentChartDemo: React.FC<SentimentChartDemoProps> = ({ isPhonePreview = false }) => {
  // Sample data points for the chart
  const dataPoints = [
    { day: 'Mon', value: 0.3 },
    { day: 'Tue', value: 0.2 },
    { day: 'Wed', value: 0.5 },
    { day: 'Thu', value: 0.4 },
    { day: 'Fri', value: 0.6 },
    { day: 'Sat', value: 0.8 },
    { day: 'Sun', value: 0.7 },
  ];

  const containerHeight = isPhonePreview ? 50 : 100;
  const containerClass = isPhonePreview ? 'h-[50px]' : 'h-[100px]';
  const textSize = isPhonePreview ? 'text-[6px]' : 'text-xs';

  return (
    <div className={`relative w-full ${containerClass} flex items-end`}>
      <div className="absolute inset-0 flex justify-between items-end pb-4">
        {dataPoints.map((point, index) => {
          const height = isPhonePreview ? 
            Math.max(4, point.value * 35) : 
            Math.max(8, point.value * 70);
          
          return (
            <div key={point.day} className="flex flex-col items-center justify-end h-full">
              <motion.div
                className="w-1 bg-primary rounded-t-sm"
                style={{ height }}
                initial={{ height: 0 }}
                animate={{ height }}
                transition={{ 
                  duration: 1,
                  delay: index * 0.1
                }}
              />
              <span className={`${textSize} text-foreground/70 mt-1`}>
                <TranslatableText text={point.day} forceTranslate={true} />
              </span>
            </div>
          );
        })}
      </div>

      {/* Trend line */}
      <svg className="absolute bottom-4 left-0 w-full h-[70%] overflow-visible">
        <motion.path
          d={`M 10 ${containerHeight * (1-dataPoints[0].value*0.7)} 
              ${dataPoints.map((point, index) => {
                const x = 10 + (index * (100/(dataPoints.length-1))) + '%';
                const y = containerHeight * (1-point.value*0.7);
                return `L ${x} ${y}`;
              }).join(' ')}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1"
          strokeDasharray="1000"
          strokeDashoffset="1000"
          initial={{ strokeDashoffset: 1000 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
};

export default SentimentChartDemo;
