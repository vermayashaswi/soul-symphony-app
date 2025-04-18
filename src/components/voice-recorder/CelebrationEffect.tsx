
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PartyPopper } from 'lucide-react';

interface CelebrationEffectProps {
  onComplete?: () => void;
}

export function CelebrationEffect({ onComplete }: CelebrationEffectProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  useEffect(() => {
    // Create particles for the celebration effect
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'];
    const newParticles = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 200,
      y: -(Math.random() * 200 + 100),
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setParticles(newParticles);

    // Trigger onComplete after animation
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <motion.div
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: [0, 1.5, 1], rotate: [0, 45, 0] }}
        transition={{ duration: 0.5 }}
        className="text-yellow-500"
      >
        <PartyPopper size={48} />
      </motion.div>
      
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full w-2 h-2"
          style={{ backgroundColor: particle.color }}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{
            scale: [0, 1, 0],
            x: particle.x,
            y: particle.y,
            opacity: [1, 0]
          }}
          transition={{
            duration: 1,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
}
