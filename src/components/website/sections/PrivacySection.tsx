
import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Eye, Check } from 'lucide-react';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const PrivacySection = () => {
  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="px-3 py-1 rounded-full bg-theme-lighter text-theme text-sm font-medium mb-4 inline-block">
            <TranslatableText text="Your Privacy Matters" />
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-theme-color">
            <TranslatableText text="Privacy-First Journaling" />
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            <TranslatableText text="Your journal entries are personal. We've built SOuLO with privacy as a core principle, not an afterthought." />
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, margin: "-100px" }}
            className="bg-white p-6 rounded-xl shadow-sm"
          >
            <div className="bg-theme-lighter w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Shield className="text-theme h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">
              <TranslatableText text="End-to-End Privacy" />
            </h3>
            <p className="text-muted-foreground">
              <TranslatableText text="Your journal entries are encrypted and can only be accessed by you. We use industry standard encryption protocols." />
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true, margin: "-100px" }}
            className="bg-white p-6 rounded-xl shadow-sm"
          >
            <div className="bg-theme-lighter w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Lock className="text-theme h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">
              <TranslatableText text="Data Control" />
            </h3>
            <p className="text-muted-foreground">
              <TranslatableText text="You own your data. Export or delete your journal entries at any time with a single tap." />
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true, margin: "-100px" }}
            className="bg-white p-6 rounded-xl shadow-sm"
          >
            <div className="bg-theme-lighter w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Eye className="text-theme h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">
              <TranslatableText text="Transparent Policies" />
            </h3>
            <p className="text-muted-foreground">
              <TranslatableText text="No hidden data collection or usage. Our privacy policy is written in plain language, not legal jargon." />
            </p>
          </motion.div>
        </div>
        
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold mb-4 text-center">
            <TranslatableText text="Our Privacy Commitment" />
          </h3>
          <ul className="space-y-3 mb-6">
            {[
              "We never sell your data to third parties",
              "Your journal entries remain yours, always",
              "We minimize data collection to only what's necessary",
              "You can request deletion of all your data at any time"
            ].map((item, index) => (
              <motion.li 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start gap-2"
              >
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span><TranslatableText text={item} /></span>
              </motion.li>
            ))}
          </ul>
          <div className="text-center">
            <Button asChild className="mt-2">
              <Link to="/legal/privacy-policy">
                <TranslatableText text="Read Our Privacy Policy" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PrivacySection;
