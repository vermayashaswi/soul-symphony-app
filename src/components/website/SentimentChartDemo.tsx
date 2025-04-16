
import React from 'react';
import { motion } from 'framer-motion';

// Simplified sentiment line chart for demonstration
const SentimentChartDemo = () => {
  // Generate mock data points for a sentiment line
  const sentimentPoints = [
    { x: 0, y: 35 },
    { x: 10, y: 20 },
    { x: 20, y: 30 },
    { x: 30, y: 15 },
    { x: 40, y: 25 },
    { x: 50, y: 10 },
    { x: 60, y: 20 },
    { x: 70, y: 15 },
    { x: 80, y: 10 },
    { x: 90, y: 5 },
    { x: 100, y: 15 }
  ];

  // Create the SVG path from the data points
  const pathData = `M ${sentimentPoints.map(point => `${point.x} ${point.y}`).join(' L ')}`;

  return (
    <div className="w-full h-full">
      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
        {/* Background grid */}
        <g className="grid" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5">
          {[0, 10, 20, 30, 40].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} />
          ))}
          {[0, 20, 40, 60, 80, 100].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2="40" />
          ))}
        </g>

        {/* Line Path */}
        <motion.path
          d={pathData}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Gradient Area under the line */}
        <motion.path
          d={`${pathData} L 100 40 L 0 40 Z`}
          fill="url(#sentimentGradient)"
          opacity="0.4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Animated data point */}
        <motion.circle
          cx={sentimentPoints[sentimentPoints.length-1].x}
          cy={sentimentPoints[sentimentPoints.length-1].y}
          r={3}
          fill="#8b5cf6"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
        />
      </svg>
    </div>
  );
};

export default SentimentChartDemo;
