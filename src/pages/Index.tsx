
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/use-onboarding';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import EnergyAnimation from '@/components/EnergyAnimation';
import HomePage from '@/pages/website/HomePage';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colorTheme } = useTheme();
  const isMobile = useIsMobile();
  const { resetOnboarding } = useOnboarding();

  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  
  const shouldRenderMobile = isMobile.isMobile || mobileDemo;

  // For the main domain, render the modern marketing homepage with features
  console.log('Rendering modern marketing homepage on main domain');
  return <HomePage />;
};

export default Index;
