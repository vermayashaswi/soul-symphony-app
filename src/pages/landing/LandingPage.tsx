
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, MessageSquare, Brain, LineChart, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import SouloLogo from '@/components/SouloLogo';
import { useIsMobile } from '@/hooks/use-mobile';

// Components
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import FeatureShowcase from './components/FeatureShowcase';
import AppDownloadSection from './components/AppDownloadSection';
import Testimonials from './components/Testimonials';
import BlogPreview from './components/BlogPreview';
import PrivacySection from './components/PrivacySection';
import Footer from './components/Footer';

const LandingPage = () => {
  const isMobile = useIsMobile();

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

  const features = [
    {
      icon: Mic,
      title: "Voice Journaling",
      description: "Record your thoughts with voice and let SOULo transcribe and analyze them automatically."
    },
    {
      icon: Brain,
      title: "AI Analysis",
      description: "Gain insights into your patterns and emotions through advanced AI analysis."
    },
    {
      icon: LineChart,
      title: "Emotional Tracking",
      description: "Visualize your emotional journey over time with interactive charts."
    },
    {
      icon: MessageSquare,
      title: "AI Assistant",
      description: "Chat with your journal and get personalized insights from your past entries."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ParticleBackground />
      <Navbar />
      
      {/* Hero Section */}
      <motion.section
        className="relative pt-20 pb-12 md:pt-32 md:pb-24 overflow-hidden px-4"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <motion.div className="w-full md:w-1/2 text-center md:text-left" variants={itemVariants}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                Express. Reflect. Grow.
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-muted-foreground">
                Discover yourself through voice journaling and AI-powered insights with SOULo.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button size="lg" className="group">
                  Download App
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/blog">Explore Blog</Link>
                </Button>
              </div>
            </motion.div>
            
            <motion.div 
              className="w-full md:w-1/2 flex justify-center md:justify-end"
              variants={itemVariants}
            >
              <div className="relative w-full max-w-sm">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-card backdrop-blur-sm border border-primary/10 rounded-2xl p-6 shadow-xl">
                  <img 
                    src="/lovable-uploads/586c1ed2-eaed-4063-a18d-500e7085909d.png" 
                    alt="SOULo App Screenshot" 
                    className="w-full rounded-lg shadow-lg"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>
      
      {/* Main Tagline */}
      <section className="py-12 md:py-20 bg-primary/5 backdrop-blur-sm">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-medium max-w-4xl mx-auto">
            Keep a journal and capture your day without writing down a single word!
          </h2>
        </div>
      </section>
      
      {/* Features Grid */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How SOULo Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                className="bg-card border border-primary/10 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
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
      
      {/* Feature Showcase */}
      <FeatureShowcase />
      
      {/* App Download Section */}
      <AppDownloadSection />
      
      {/* Privacy Section */}
      <PrivacySection />
      
      {/* Blog Preview */}
      <BlogPreview />
      
      {/* Testimonials/Future Users Section */}
      <Testimonials />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;
