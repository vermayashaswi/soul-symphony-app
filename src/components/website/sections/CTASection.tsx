
import React from 'react';
import { motion } from 'framer-motion';
import { Apple, Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface CTASectionProps {
  openAppStore: () => void;
  openPlayStore: () => void;
}

const CTASection: React.FC<CTASectionProps> = ({ openAppStore, openPlayStore }) => {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-primary via-purple-600 to-blue-600 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 border border-white rounded-full"></div>
        <div className="absolute top-32 right-20 w-32 h-32 border border-white rounded-full"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 border border-white rounded-full"></div>
        <div className="absolute bottom-32 right-10 w-24 h-24 border border-white rounded-full"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white">
            <TranslatableText text="Ready to Transform Your Mental Wellness?" />
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8 leading-relaxed">
            <TranslatableText text="Join thousands who have discovered the power of voice journaling. Start your free trial today and experience the difference." />
          </p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
          >
            <Button 
              size="lg" 
              className="gap-2 bg-white text-primary hover:bg-gray-100 text-lg px-8 py-4 h-auto" 
              onClick={openAppStore}
            >
              <Apple className="h-5 w-5" />
              <TranslatableText text="Download for iOS" />
            </Button>
            <Button 
              size="lg" 
              className="gap-2 bg-black text-white hover:bg-gray-800 text-lg px-8 py-4 h-auto" 
              onClick={openPlayStore}
            >
              <Play className="h-5 w-5" />
              <TranslatableText text="Download for Android" />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center justify-center gap-2 text-white/80"
          >
            <span className="text-sm">
              <TranslatableText text="Free 14-day trial • No credit card required" />
            </span>
            <ArrowRight className="h-4 w-4 animate-pulse" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
