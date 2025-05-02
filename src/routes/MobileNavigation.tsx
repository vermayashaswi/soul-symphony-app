
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isAppRoute } from './RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

// Note: This component is being replaced by the one in src/components/MobileNavigation.tsx
// This file is kept only for backward compatibility and should eventually be removed
const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // We're no longer using this component, direct to the new one
    console.log('Legacy MobileNavigation in routes folder is deprecated');
    setIsVisible(false);
  }, []);
  
  // Always return null to avoid duplicate navigation bars
  return null;
};

export default MobileNavigation;
