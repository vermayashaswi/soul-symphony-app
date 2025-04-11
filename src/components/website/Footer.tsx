
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Apple, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SouloLogo from '@/components/SouloLogo';

const Footer = () => {
  const { t } = useTranslation();

  const openAppStore = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const appStoreUrl = 'https://apps.apple.com/app/soulo';
    
    if (isIOS) {
      window.location.href = 'itms-apps://itunes.apple.com/app/soulo';
      setTimeout(() => {
        window.location.href = appStoreUrl;
      }, 500);
    } else {
      window.open(appStoreUrl, '_blank');
    }
  };

  const openPlayStore = () => {
    const isAndroid = /Android/.test(navigator.userAgent);
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.soulo.app';
    
    if (isAndroid) {
      window.location.href = 'market://details?id=com.soulo.app';
      setTimeout(() => {
        window.location.href = playStoreUrl;
      }, 500);
    } else {
      window.open(playStoreUrl, '_blank');
    }
  };

  return (
    <footer className="bg-white py-16 border-t border-gray-100">
      <div className="container mx-auto px-4 text-center">
        <SouloLogo size="large" useColorTheme={true} className="mx-auto mb-8" />
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto mb-12">
          <Button 
            className="gap-2 bg-black text-white hover:bg-gray-800" 
            onClick={openAppStore}
          >
            <Apple className="h-5 w-5" />
            <span>{t('download.appStore')}</span>
          </Button>
          <Button 
            className="gap-2 bg-primary hover:bg-primary/90" 
            onClick={openPlayStore}
          >
            <Play className="h-5 w-5" />
            <span>{t('download.googlePlay')}</span>
          </Button>
          {/* Removed "Try Web App" button */}
        </div>
        
        <p className="text-muted-foreground mb-8">
          {t('footer.contact')} <a href="mailto:support@soulo.online" className="text-primary hover:underline">support@soulo.online</a>
        </p>
        
        <div className="flex justify-center gap-8 text-sm text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-primary">{t('footer.privacy')}</Link>
          <Link to="/terms" className="hover:text-primary">{t('footer.terms')}</Link>
          <Link to="/blog" className="hover:text-primary">{t('navbar.blog')}</Link>
          <Link to="/faq" className="hover:text-primary">{t('navbar.faq')}</Link>
        </div>
        
        <p className="text-xs text-muted-foreground mt-8">
          &copy; {new Date().getFullYear()} SOULo. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
