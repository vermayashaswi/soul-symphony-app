
import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const PrivacySection = () => {
  const privacyFeatures = [
    {
      icon: Shield,
      title: "Your Data Stays Private",
      description: "SOULo is designed with privacy at its core. Your journal entries are stored only on your device."
    },
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "All voice data and entries are processed with end-to-end encryption for maximum security."
    },
    {
      icon: Server,
      title: "No Third-Party Access",
      description: "Your data is never shared with third parties, ensuring your thoughts remain completely private."
    }
  ];

  return (
    <section className="py-16 md:py-24 bg-primary/5 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-12">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Truly Private and Secure
          </motion.h2>
          <motion.p 
            className="text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            At SOULo, we believe your personal thoughts deserve the highest level of privacy and security.
          </motion.p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {privacyFeatures.map((feature, index) => (
            <motion.div 
              key={index}
              className="bg-card border border-primary/10 rounded-xl p-6 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
            >
              <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
        
        <motion.div 
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <p className="mb-4 text-muted-foreground">
            The most important thing is that only SOULo app is able to read your entries. We don't send your data to our servers, so we don't have access to your entries. Your privacy is our priority.
          </p>
          <Button variant="outline" asChild>
            <Link to="/privacy-policy">Read Our Privacy Policy</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default PrivacySection;
