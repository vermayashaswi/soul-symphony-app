
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const FeatureShowcase = () => {
  const { t } = useTranslation();
  
  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-transparent to-primary/5">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <motion.div 
            className="order-2 md:order-1"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">
              {t('feature1.title')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('feature1.title')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('feature1.description')}
            </p>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Speak naturally in your own language</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Advanced speech recognition technology</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2">•</span>
                <span>Supports over 20 languages</span>
              </li>
            </ul>
          </motion.div>
          
          <motion.div 
            className="order-1 md:order-2"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
              <div className="relative p-2 bg-card rounded-2xl shadow-xl border border-primary/10">
                <img 
                  src="/lovable-uploads/feature-voice.png" 
                  alt="Voice Journaling Feature" 
                  className="w-full rounded-xl"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;
