
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
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30 pointer-events-none">
        <div className="absolute -top-20 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute top-40 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-40 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 relative z-10">
        <div className="text-center mb-12">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">
            Privacy First
          </span>
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
              className="bg-card border border-primary/10 rounded-xl p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
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
          <p className="mb-6 text-muted-foreground max-w-3xl mx-auto">
            The most important thing is that only SOULo app is able to read your entries. We don't send your data to our servers, so we don't have access to your entries. Your privacy is our priority.
          </p>
          <Button variant="outline" asChild className="group">
            <Link to="/privacy-policy">
              Read Our Privacy Policy
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default PrivacySection;
