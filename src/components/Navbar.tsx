import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Home, MessageCircle, BarChart2, Settings, Menu, X, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import SouloLogo from '@/components/SouloLogo';
import LanguageSelector from '@/components/LanguageSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isAppRoute } from '@/routes/RouteHelpers';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [scrolled, setScrolled] = useState(false);
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mobileDemo = urlParams.get('mobileDemo') === 'true';
  const shouldHideNavbar = isMobile.isMobile || mobileDemo;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getUserInitials = () => {
    if (!user) return "?";
    
    const email = user.email || "";
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    
    return "U";
  };

  const navItems = [
    { path: '/', label: t('navbar.home'), icon: Home },
    { path: '/app/home', label: 'Dashboard', icon: Home },
    { path: '/app/journal', label: 'Journal', icon: Home },
    { path: '/app/insights', label: 'Insights', icon: BarChart2 },
    { path: '/app/smart-chat', label: 'AI Assistant', icon: MessageCircle },
    { path: '/app/settings', label: 'Settings', icon: Settings },
  ];

  const handleNavigation = (path: string) => {
    if (!user && isAppRoute(path)) {
      navigate(`/app/auth?redirectTo=${path}`);
    } else {
      navigate(path);
    }
    closeMenu();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      closeMenu();
    } catch (error) {
      console.error('Error signing out from navbar:', error);
    }
  };

  const closeMenu = () => setIsOpen(false);

  if (shouldHideNavbar || isAppRoute(location.pathname)) {
    return null;
  }

  return (
    <nav 
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300 px-4 md:px-8",
        scrolled || isOpen ? "backdrop-blur-xl bg-white/70 shadow-md py-3" : "py-5"
      )}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center"
          >
            <SouloLogo useColorTheme={true} />
          </motion.div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <Button variant="ghost" className="text-black hover:text-black" asChild>
            <Link to="/blog">{t('navbar.blog')}</Link>
          </Button>
          <Button variant="ghost" className="text-black hover:text-black" asChild>
            <Link to="/faq">{t('navbar.faq')}</Link>
          </Button>
          <Button variant="ghost" className="text-black hover:text-black" asChild>
            <Link to="/app">{t('navbar.openApp')}</Link>
          </Button>
          
          <LanguageSelector />
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || ""} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" className="text-black hover:text-black" asChild>
              <Link to="/app/auth">
                <LogIn className="mr-2 h-4 w-4" />
                {t('navbar.signIn')}
              </Link>
            </Button>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          <LanguageSelector />
          <Link to="/app">
            <Button size="sm">{t('navbar.openApp')}</Button>
          </Link>
          
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-black"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {isMobile.isMobile && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ 
            height: isOpen ? 'auto' : 0,
            opacity: isOpen ? 1 : 0
          }}
          transition={{ duration: 0.3 }}
          className="md:hidden overflow-hidden"
        >
          <div className="py-4 flex flex-col gap-2">
            <Button variant="ghost" className="text-black hover:text-black" asChild>
              <Link to="/" onClick={closeMenu}>{t('navbar.home')}</Link>
            </Button>
            <Button variant="ghost" className="text-black hover:text-black" asChild>
              <Link to="/blog" onClick={closeMenu}>{t('navbar.blog')}</Link>
            </Button>
            <Button variant="ghost" className="text-black hover:text-black" asChild>
              <Link to="/faq" onClick={closeMenu}>{t('navbar.faq')}</Link>
            </Button>
            <Button variant="ghost" className="text-black hover:text-black" asChild>
              <Link to="/app" onClick={closeMenu}>{t('navbar.openApp')}</Link>
            </Button>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

export default Navbar;
