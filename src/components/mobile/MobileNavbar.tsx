
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  User, 
  MessageSquare, 
  LineChart,
  Globe
} from 'lucide-react';
import SouloLogo from '@/components/SouloLogo';
import LanguageSelectorRefactored from '@/components/LanguageSelectorRefactored';

const MobileNavbar = () => {
  const navigate = useNavigate();

  return (
    <motion.nav
      className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t px-4 py-2 z-50"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="p-0" 
          onClick={() => navigate('/')}
        >
          <SouloLogo size="small" useColorTheme={true} />
        </Button>

        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
          <User className="h-5 w-5" />
        </Button>
        
        <LanguageSelectorRefactored />
        
        <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
          <MessageSquare className="h-5 w-5" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={() => navigate('/insights')}>
          <LineChart className="h-5 w-5" />
        </Button>
      </div>
    </motion.nav>
  );
};

export default MobileNavbar;
