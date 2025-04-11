
import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PrivacySection = () => {
  const { t } = useTranslation();
  
  const privacyFeatures = [
    t('homepage.privacy.featuresList.0'),
    t('homepage.privacy.featuresList.1'),
    t('homepage.privacy.featuresList.2'),
    t('homepage.privacy.featuresList.3')
  ];

  return (
    <section className="py-16 md:py-24" data-i18n-section="privacy-section">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <motion.div 
            className="w-full md:w-1/2"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block" data-i18n-key="homepage.privacy.title">
              {t('homepage.privacy.title')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-i18n-key="homepage.privacy.title">{t('homepage.privacy.title')}</h2>
            <p className="text-muted-foreground mb-6" data-i18n-key="homepage.privacy.description">
              {t('homepage.privacy.description')}
            </p>
            
            <ul className="space-y-3">
              {privacyFeatures.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Shield className="h-5 w-5 text-primary mr-2 mt-0.5" />
                  <span data-i18n-key={`homepage.privacy.featuresList.${index}`}>{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          
          <motion.div 
            className="w-full md:w-1/2"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
              <div className="relative bg-card border border-primary/10 rounded-2xl p-6 shadow-xl">
                <img 
                  src="/lovable-uploads/security-illustration.svg" 
                  alt="Privacy and Security" 
                  className="w-full"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PrivacySection;
