
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, MessageSquare, Brain, LineChart, Mic, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';

// Components
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import FeatureShowcase from './components/FeatureShowcase';
import AppDownloadSection from './components/AppDownloadSection';
import Testimonials from './components/Testimonials';
import BlogPreview from './components/BlogPreview';
import PrivacySection from './components/PrivacySection';
import Footer from './components/Footer';
import { OptimizedImage } from '@/utils/imageUtils';
import SpiritualRobotAnimation from '@/components/website/SpiritualRobotAnimation';
import LanguageSelector from '@/components/website/LanguageSelector';
import ProcessSteps from '@/components/website/ProcessSteps';

const LandingPage = () => {
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
      description: "Record your thoughts with voice and let SOuLO transcribe and analyze them automatically."
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

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ParticleBackground />
      <header className="relative z-20">
        <Navbar />
        <div className="container mx-auto px-4 flex justify-end pt-4">
          <LanguageSelector />
        </div>
      </header>
      
      {/* Hero Section */}
      <motion.section
        className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden px-4"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <motion.div className="w-full md:w-1/2 text-center md:text-left" variants={itemVariants}>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">
                Introducing SOuLO
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                Express. Reflect.{" "}
                <span className="text-primary">Grow.</span>
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-muted-foreground">
                Discover yourself through voice journaling and AI-powered insights with SOuLO.
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
              <SpiritualRobotAnimation className="w-full max-w-sm h-96" />
            </motion.div>
          </div>
          
          <motion.div 
            className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 cursor-pointer"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            onClick={scrollToFeatures}
          >
            <span className="text-sm text-muted-foreground">Discover More</span>
            <ChevronDown className="animate-bounce" />
          </motion.div>
        </div>
      </motion.section>
      
      {/* Main Tagline */}
      <section className="py-12 md:py-16 bg-primary/5 backdrop-blur-sm">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-medium max-w-4xl mx-auto">
            Keep a journal and capture your day without writing down a single word!
          </h2>
        </div>
      </section>
      
      {/* Features Grid */}
      <section id="features" className="py-16 md:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How SOuLO Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our innovative approach combines voice journaling with AI technology to provide you with meaningful insights about yourself.
            </p>
          </div>
          
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
      
      {/* Process Steps Section */}
      <ProcessSteps />
      
      {/* Privacy Section */}
      <PrivacySection />
      
      {/* App Download Section */}
      <AppDownloadSection />
      
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
