
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import SouloLogoSafe from '@/components/SouloLogoSafe';
import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';

// Create custom icons for app stores
const AppleStoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20.94c1.5 0 2.75-.67 3.95-1.34 1.24-.67 2.23-1.76 2.73-3.02.32-.85.47-1.76.47-2.75 0-1.27-.47-2.44-1.28-3.32-.97-1.08-2.34-1.69-3.72-1.69-.53 0-1.13.15-1.76.44-.53.25-.97.49-1.32.73-.34-.23-.79-.48-1.32-.73-.62-.3-1.23-.45-1.77-.45-1.38 0-2.76.6-3.72 1.69-.82.88-1.29 2.05-1.29 3.32 0 .99.15 1.9.47 2.75.5 1.26 1.49 2.35 2.73 3.02 1.2.67 2.45 1.34 3.95 1.34z" />
    <path d="M12 8.62c.16-.59.3-1.21.47-1.84.34-1.26 1.87-2.1 2.8-2.36 0 0-.74 2.72-2.3 2.72-1.13 0-1.28.88-.97 1.48z" />
    <path d="M12 8.62c-.16-.59-.3-1.21-.47-1.84-.34-1.26-1.87-2.1-2.8-2.36 0 0 .74 2.72 2.3 2.72 1.13 0 1.28.88.97 1.48z" />
  </svg>
);

const GooglePlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.5 4.27c-.93.93-1.5 2.2-1.5 3.6v8.26c0 1.4.58 2.68 1.5 3.6" />
    <path d="M16.5 4.27c.93.93 1.5 2.2 1.5 3.6v8.26c0 1.4-.58 2.68-1.5 3.6" />
    <path d="M4 10.07h3" />
    <path d="M17 10.07h3" />
    <path d="M12 19.93v3.5" />
    <path d="M12 6.57v-5" />
    <rect x="7" y="6.57" width="10" height="13.36" rx="3" />
  </svg>
);

const AppDownload = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  const pulseVariants = {
    pulse: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ParticleBackground />
      <Navbar />
      
      <motion.main
        className="flex-1 container mx-auto px-4 py-12 relative z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          className="text-center mb-12" 
          variants={itemVariants}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-6 flex items-center justify-center">
            <span className="text-foreground dark:text-white">Download</span> 
            <SouloLogoSafe className="ml-2" useColorTheme={true} animate={true} disableTheme={true} />
          </h1>
          <p className="text-xl max-w-2xl mx-auto text-primary mb-8">
            SOULo is available exclusively as a mobile app for iOS and Android
          </p>
          
          <motion.div variants={pulseVariants} animate="pulse" className="max-w-md mx-auto mb-12">
            <Card className="border-primary/30 shadow-lg">
              <CardContent className="p-6">
                <p className="mb-4 text-muted-foreground">
                  Our app provides the best experience on your mobile device, with features like:
                </p>
                <ul className="text-left space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span> Voice recording for easier journaling
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span> Offline mode for journaling anywhere
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span> Push notifications for journaling reminders
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-primary">✓</span> Enhanced privacy and security
                  </li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
        
        <motion.div
          className="flex flex-col md:flex-row gap-6 justify-center items-center max-w-xl mx-auto"
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="w-full md:w-1/2">
            <Button 
              variant="outline" 
              size="lg"
              className="w-full h-16 text-lg border-2 hover:bg-primary/10"
              onClick={() => window.open('https://apps.apple.com/app/soulo-journal', '_blank')}
            >
              <AppleStoreIcon />
              <div className="flex flex-col items-start ml-2 text-left">
                <span className="text-xs">Download on the</span>
                <span className="font-semibold">App Store</span>
              </div>
            </Button>
          </motion.div>
          
          <motion.div variants={itemVariants} className="w-full md:w-1/2">
            <Button 
              variant="outline" 
              size="lg"
              className="w-full h-16 text-lg border-2 hover:bg-primary/10"
              onClick={() => window.open('https://play.google.com/store/apps/details?id=app.soulo.journal', '_blank')}
            >
              <GooglePlayIcon />
              <div className="flex flex-col items-start ml-2 text-left">
                <span className="text-xs">Get it on</span>
                <span className="font-semibold">Google Play</span>
              </div>
            </Button>
          </motion.div>
        </motion.div>
        
        <motion.div
          className="text-center mt-12" 
          variants={itemVariants}
        >
          <p className="text-muted-foreground">
            By downloading, you agree to our <Link to="/privacy-policy" className="text-primary underline">Privacy Policy</Link>
          </p>
          
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-2">Questions or feedback?</h2>
            <p className="text-muted-foreground">
              Contact us at <a href="mailto:support@soulo.online" className="text-primary underline">support@soulo.online</a>
            </p>
          </div>
        </motion.div>
      </motion.main>
    </div>
  );
};

export default AppDownload;
