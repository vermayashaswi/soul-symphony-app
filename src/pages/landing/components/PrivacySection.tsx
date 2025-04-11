
import React from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

const PrivacySection = () => {
  const privacyFeatures = [
    "End-to-end encryption",
    "Local storage options",
    "No sharing with third parties",
    "Full control over your data"
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <motion.div 
            className="w-full md:w-1/2"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">
              Your Privacy Is Our Priority
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Privacy Is Our Priority</h2>
            <p className="text-muted-foreground mb-6">
              We use state-of-the-art encryption to ensure your journal entries remain completely private and secure.
            </p>
            
            <ul className="space-y-3">
              {privacyFeatures.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Shield className="h-5 w-5 text-primary mr-2 mt-0.5" />
                  <span>{feature}</span>
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
