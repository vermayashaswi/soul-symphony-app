import React from 'react';
import { motion } from 'framer-motion';
import { Apple, PlayIcon, ArrowRight, Shield, Mic, Brain, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import SouloLogo from '@/components/SouloLogo';
import Navbar from '@/components/Navbar';
import Footer from '@/components/website/Footer';

const AppDownloadPage = () => {
  const appFeatures = [
    {
      icon: Mic,
      title: "Voice Journaling",
      description: "Speak your thoughts and let SOULo transcribe and analyze them automatically."
    },
    {
      icon: Brain,
      title: "AI Insights",
      description: "Gain deeper understanding of your emotions through advanced AI analysis."
    },
    {
      icon: Shield,
      title: "Complete Privacy",
      description: "Your data stays private with end-to-end encryption and local storage."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <motion.section
        className="pt-24 md:pt-32 pb-16 relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto max-w-6xl px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <motion.div 
              className="w-full md:w-1/2 text-center md:text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Download SOULo Today
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Begin your journey of self-discovery through voice journaling and AI-powered insights.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
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
              
              <p className="text-sm text-muted-foreground mt-4">
                Free to download. Premium features available.
              </p>
            </motion.div>
            
            <motion.div 
              className="w-full md:w-1/2 flex justify-center md:justify-end"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-card backdrop-blur-sm border border-primary/10 rounded-2xl p-6 shadow-xl">
                  <img 
                    src="/lovable-uploads/586c1ed2-eaed-4063-a18d-500e7085909d.png" 
                    alt="SOULo App Screenshot" 
                    className="w-full max-w-xs rounded-lg shadow-lg"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>
      
      {/* Features Section */}
      <section className="py-16 bg-primary/5">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose SOULo?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {appFeatures.map((feature, index) => (
              <motion.div 
                key={index}
                className="bg-card border border-primary/10 rounded-xl p-6 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Screenshots Section */}
      <section className="py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-center mb-4">App Screenshots</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Get a glimpse of the SOULo experience before you download.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              className="rounded-xl overflow-hidden shadow-md"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <img 
                src="/lovable-uploads/5b18686b-4a3c-4341-a072-479db470ac1d.png" 
                alt="SOULo Voice Journaling" 
                className="w-full h-auto"
              />
            </motion.div>
            
            <motion.div 
              className="rounded-xl overflow-hidden shadow-md"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <img 
                src="/lovable-uploads/cb710491-93f0-42be-a596-f64d80d9800e.png" 
                alt="SOULo Insights" 
                className="w-full h-auto"
              />
            </motion.div>
            
            <motion.div 
              className="rounded-xl overflow-hidden shadow-md"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <img 
                src="/lovable-uploads/a66f2232-4b39-4d46-ace5-19e4c81b1f05.png" 
                alt="SOULo AI Chat" 
                className="w-full h-auto"
              />
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Steps to Download */}
      <section className="py-16 bg-primary/5">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-3xl font-bold text-center mb-4">How to Get Started</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Follow these simple steps to begin your journey with SOULo.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <Download className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">1. Download the App</h3>
              <p className="text-muted-foreground">
                Get SOULo from the App Store or Google Play Store for free.
              </p>
            </motion.div>
            
            <motion.div 
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <span className="text-primary text-2xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-bold mb-2">2. Create an Account</h3>
              <p className="text-muted-foreground">
                Sign up with your email or connect with Google or Apple.
              </p>
            </motion.div>
            
            <motion.div 
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">3. Start Journaling</h3>
              <p className="text-muted-foreground">
                Record your first voice journal entry and begin your self-discovery journey.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="bg-card border border-primary/10 rounded-xl p-8 md:p-10 text-center shadow-sm">
            <SouloLogo size="large" useColorTheme={true} className="mx-auto mb-6" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Discover Yourself?</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Download SOULo today and begin your journey of self-expression, reflection, and growth.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                Download for iOS
              </Button>
              <Button size="lg" variant="outline" className="flex items-center gap-2">
                <PlayIcon className="h-5 w-5" />
                Download for Android
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Or <Link to="/" className="text-primary hover:underline">learn more</Link> about SOULo's features
            </p>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default AppDownloadPage;
