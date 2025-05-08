
import React from 'react';
import { motion } from 'framer-motion';

interface Point {
  x: number;
  y: number;
}

interface TutorialConnectorProps {
  start: Point;
  end: Point;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TutorialConnector: React.FC<TutorialConnectorProps> = ({ start, end, position }) => {
  // Calculate control points for the bezier curve based on the position
  const getControlPoints = () => {
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    switch (position) {
      case 'top':
        return {
          cp1: { x: midX, y: start.y - 30 },
          cp2: { x: midX, y: end.y + 30 }
        };
      case 'bottom':
        return {
          cp1: { x: midX, y: start.y + 30 },
          cp2: { x: midX, y: end.y - 30 }
        };
      case 'left':
        return {
          cp1: { x: start.x - 30, y: midY },
          cp2: { x: end.x + 30, y: midY }
        };
      case 'right':
        return {
          cp1: { x: start.x + 30, y: midY },
          cp2: { x: end.x - 30, y: midY }
        };
      case 'center':
        // For center position, create a subtle arc
        return {
          cp1: { x: midX, y: start.y },
          cp2: { x: midX, y: end.y }
        };
      default:
        return {
          cp1: { x: midX, y: start.y },
          cp2: { x: midX, y: end.y }
        };
    }
  };

  const { cp1, cp2 } = getControlPoints();
  
  // Don't render a connector for center position
  if (position === 'center') {
    return null;
  }
  
  // SVG path for the bezier curve
  const path = `M${start.x},${start.y} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${end.x},${end.y}`;
  
  return (
    <motion.svg 
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-[9998]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ 
        position: 'fixed', 
        zIndex: 9998
      }}
    >
      <motion.path
        d={path}
        fill="none"
        stroke="rgb(var(--primary))"
        strokeWidth="2"
        strokeDasharray="4 4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.6 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      />
      <motion.circle
        cx={end.x}
        cy={end.y}
        r={6}
        fill="rgb(var(--primary))"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.4 }}
      />
    </motion.svg>
  );
};

export default TutorialConnector;
