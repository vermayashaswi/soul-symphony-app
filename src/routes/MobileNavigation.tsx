
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTutorial } from '@/contexts/TutorialContext';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

// Note: This component is being replaced by the one in src/components/MobileNavigation.tsx
// This file is kept only for backward compatibility and should eventually be removed
const MobileNavigation: React.FC<MobileNavigationProps> = () => {
  console.log('Legacy MobileNavigation in routes folder is deprecated');
  return null;
};

export default MobileNavigation;
