
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Apple, PlayIcon } from 'lucide-react';
import { OptimizedImage } from '@/utils/imageUtils';

const AppDownloadSection = () => {
  return (
    <section className="py-16 md:py-24 bg-background relative overflow-hidden" id="download-section">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto max-w-6xl px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <motion.div 
            className="w-full md:w-1/2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Download and Start Using SOuLO Today!
            </h2>
            <p className="text-muted-foreground mb-8">
              It's free to download and easy to use. Begin your journey of self-discovery with SOuLO - your personal companion for emotional wellness.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="outline" 
                size="lg" 
                className="bg-black text-white hover:bg-black/90 border-none flex items-center justify-center gap-2 h-16"
              >
                <Apple className="h-6 w-6" />
                <div className="flex flex-col items-start">
                  <span className="text-xs">Download on the</span>
                  <span className="text-base font-semibold">App Store</span>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="bg-black text-white hover:bg-black/90 border-none flex items-center justify-center gap-2 h-16"
              >
                <PlayIcon className="h-6 w-6" />
                <div className="flex flex-col items-start">
                  <span className="text-xs">Get it on</span>
                  <span className="text-base font-semibold">Google Play</span>
                </div>
              </Button>
            </div>
          </motion.div>
          
          <motion.div 
            className="w-full md:w-1/2 flex justify-center md:justify-end"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
              <div className="relative bg-card backdrop-blur-sm border border-primary/10 rounded-2xl p-6 shadow-xl">
                <OptimizedImage 
                  src="appScreenshot" 
                  alt="SOuLO App Screenshot" 
                  className="w-full max-w-xs rounded-lg shadow-lg"
                />
              </div>
              
              <div className="absolute -bottom-4 -right-4 bg-card rounded-xl p-3 shadow-lg border border-primary/10">
                <div className="flex flex-col items-center">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs mt-1">Coming soon</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        
        <div className="mt-16 grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center">
            <h3 className="text-xl md:text-2xl font-bold text-primary">Est. 2024</h3>
            <p className="text-sm text-muted-foreground">New & Innovative</p>
          </div>
          
          <div className="flex flex-col items-center">
            <h3 className="text-xl md:text-2xl font-bold text-primary">100% Privacy</h3>
            <p className="text-sm text-muted-foreground">Your data is safe</p>
          </div>
          
          <div className="flex flex-col items-center md:col-span-1 col-span-2">
            <h3 className="text-xl md:text-2xl font-bold text-primary">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">Personalized insights</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppDownloadSection;
