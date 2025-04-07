
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

interface RecordingVisualizerProps {
  isRecording: boolean;
  audioLevel: number;
  ripples: number[];
}

export function RecordingVisualizer({ 
  isRecording, 
  audioLevel, 
  ripples 
}: RecordingVisualizerProps) {
  // Don't render this component at all per user request
  return null;
}
