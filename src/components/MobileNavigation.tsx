
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, MessageCircle, BookOpen, BarChart2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeApp, isAppRoute } from '@/routes/RouteHelpers';
import { useIsMobile } from '@/hooks/use-mobile';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTutorial } from '@/contexts/TutorialContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { staticTranslationService } from '@/services/staticTranslationService';

interface MobileNavigationProps {
  onboardingComplete: boolean | null;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onboardingComplete }) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { isActive: isTutorialActive } = useTutorial();
  const { user } = useAuth();
  const { currentLanguage } = useTranslation();
  
  // Debug: Force component re-render when language changes
  const [renderKey, setRenderKey] = useState(0);
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  // Test translation service connectivity on mount
  useEffect(() => {
    const testAndClearCache = async () => {
      console.log('MobileNavigation: Testing translation service and clearing cache...');
      
      try {
        // Clear translation cache
        await staticTranslationService.clearAllCaches();
        console.log('MobileNavigation: Translation cache cleared');
        
        // Test connection
        const isConnected = await staticTranslationService.testConnection();
        console.log('MobileNavigation: Translation service connection test result:', isConnected);
        
        setDebugInfo(`Cache cleared, Connection: ${isConnected ? 'OK' : 'FAILED'}`);
      } catch (error) {
        console.error('MobileNavigation: Error during translation service test:', error);
        setDebugInfo(`Test failed: ${error}`);
      }
    };
    
    testAndClearCache();
  }, []);
  
  useEffect(() => {
    const handleLanguageChange = () => {
      console.log('MobileNavigation: Language change detected, forcing re-render and clearing cache');
      
      // Clear cache when language changes
      staticTranslationService.clearAllCaches().then(() => {
        console.log('MobileNavigation: Cache cleared after language change');
      }).catch(err => {
        console.error('MobileNavigation: Failed to clear cache after language change:', err);
      });
      
      setRenderKey(prev => prev + 1);
    };
    
    window.addEventListener('languageChange', handleLanguageChange);
    return () => window.removeEventListener('languageChange', handleLanguageChange);
  }, []);
  
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        setIsKeyboardVisible(isKeyboard);
      }
    };
    
    handleVisualViewportResize();
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.addEventListener('resize', handleVisualViewportResize);
    }
    
    const handleKeyboardOpen = () => setIsKeyboardVisible(true);
    const handleKeyboardClose = () => setIsKeyboardVisible(false);
    
    window.addEventListener('keyboardOpen', handleKeyboardOpen);
    window.addEventListener('keyboardClose', handleKeyboardClose);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.removeEventListener('resize', handleVisualViewportResize);
      }
      
      window.removeEventListener('keyboardOpen', handleKeyboardOpen);
      window.removeEventListener('keyboardClose', handleKeyboardClose);
    };
  }, []);
  
  useEffect(() => {
    const onboardingOrAuthPaths = [
      '/app/onboarding',
      '/app/auth',
      '/onboarding',
      '/auth',
      '/app',
      '/'
    ];
    
    const isOnboardingOrAuth = onboardingOrAuthPaths.includes(location.pathname);
    const isAppRoot = location.pathname === '/app';
    
    const shouldShowNav = (isMobile || isNativeApp()) && 
                          !isKeyboardVisible && 
                          !isOnboardingOrAuth &&
                          !!user &&
                          onboardingComplete !== false;
    
    console.log('MobileNavigation visibility check:', { 
      shouldShowNav, 
      isMobile, 
      isNativeApp: isNativeApp(),
      path: location.pathname,
      isKeyboardVisible,
      isOnboardingOrAuth,
      isAppRoot,
      hasUser: !!user,
      onboardingComplete,
      isTutorialActive,
      currentLanguage,
      renderKey,
      debugInfo
    });
    
    setIsVisible(shouldShowNav);
  }, [location.pathname, isMobile, isKeyboardVisible, isTutorialActive, user, onboardingComplete, currentLanguage, renderKey, debugInfo]);
  
  if (!isVisible) {
    return null;
  }
  
  if (onboardingComplete === false || location.pathname === '/app') {
    console.log('MobileNavigation: Not rendering due to onboarding status or /app path');
    return null;
  }
  
  // Navigation items with English text for translation
  const navItems = [
    { path: '/app/home', icon: Home, label: 'Home' },
    { path: '/app/journal', icon: BookOpen, label: 'Journal' },
    { path: '/app/smart-chat', icon: MessageCircle, label: 'Chat' },
    { path: '/app/insights', icon: BarChart2, label: 'Insights' },
    { path: '/app/settings', icon: Settings, label: 'Settings' },
  ];

  const getActiveStatus = (path: string) => {
    return location.pathname.startsWith(path);
  };
  
  console.log('MobileNavigation: Rendering with language:', currentLanguage, 'renderKey:', renderKey, 'debugInfo:', debugInfo);
  
  return (
    <motion.div 
      key={`nav-${renderKey}-${currentLanguage}`}
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t border-muted",
        isTutorialActive && "opacity-30 pointer-events-none"
      )}
      style={{
        zIndex: 9998,
        paddingTop: '0.40rem',
        paddingBottom: 'max(0.40rem, env(safe-area-inset-bottom))',
        height: 'calc(3.6rem + env(safe-area-inset-bottom))'
      }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Debug info overlay (remove in production) */}
      {debugInfo && currentLanguage !== 'en' && (
        <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs p-1 text-center">
          Debug: {debugInfo} | Lang: {currentLanguage} | Key: {renderKey}
        </div>
      )}
      
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = getActiveStatus(item.path);
          
          console.log(`MobileNavigation: Rendering nav item "${item.label}" for path ${item.path} with language ${currentLanguage}, renderKey ${renderKey}`);
          
          return (
            <Link
              key={`${item.path}-${renderKey}-${currentLanguage}`}
              to={item.path}
              className={cn(
                "flex flex-col items-center py-1 transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className="relative">
                <item.icon size={22} />
                {isActive && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.3 }}
                  />
                )}
              </div>
              <span className="text-xs mt-0.5">
                <TranslatableText 
                  key={`${item.label}-${renderKey}-${currentLanguage}-force`}
                  text={item.label} 
                  forceTranslate={true}
                  onTranslationStart={() => console.log(`MobileNavigation: Translation started for "${item.label}" to ${currentLanguage} (attempt ${renderKey})`)}
                  onTranslationEnd={() => console.log(`MobileNavigation: Translation completed for "${item.label}" to ${currentLanguage} (attempt ${renderKey})`)}
                />
              </span>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
};

export default MobileNavigation;
