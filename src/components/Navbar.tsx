
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import SouloLogo from './SouloLogo';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useEffect } from 'react';
import { 
  MoreVertical, 
  LogOut,
  Settings,
  HelpCircle,
  Home,
  Moon,
  Sun,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTheme } from '@/hooks/use-theme';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { useTranslation } from '@/contexts/TranslationContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth(); 
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const { currentLanguage, prefetchTranslationsForRoute } = useTranslation();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  // Pre-fetch common navbar translations
  useEffect(() => {
    const navLabels = ['Home', 'Settings', 'Help', 'Logout', 'Sign In'];
    prefetchTranslationsForRoute(navLabels).catch(console.error);
  }, [currentLanguage, prefetchTranslationsForRoute]);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b px-4 py-2 shadow-sm"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" className="p-0" onClick={() => navigate('/')}>
            <SouloLogo size="normal" useColorTheme={true} />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {!user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <TranslatableText text="Home" forceTranslate={true} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                <TranslatableText text="Sign In" forceTranslate={true} />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 mr-4">
                  <div className="grid gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => navigate('/')}
                    >
                      <Home className="mr-2 h-4 w-4" />
                      <TranslatableText text="Home" forceTranslate={true} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => navigate('/settings')}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <TranslatableText text="Settings" forceTranslate={true} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => navigate('/help')}
                    >
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <TranslatableText text="Help" forceTranslate={true} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <TranslatableText text="Logout" forceTranslate={true} />
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Avatar
                className="cursor-pointer"
                onClick={() => navigate('/profile')}
              >
                <AvatarImage src={user.user_metadata?.avatar_url || user.user_metadata?.picture} />
                <AvatarFallback>
                  {user.user_metadata?.name ? user.user_metadata.name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
