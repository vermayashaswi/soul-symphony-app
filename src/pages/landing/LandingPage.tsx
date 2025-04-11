import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, MessageSquare, Brain, LineChart, Mic, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Components
import Navbar from '@/components/website/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import FeatureShowcase from './components/FeatureShowcase';
import AppDownloadSection from './components/AppDownloadSection';
import Testimonials from './components/Testimonials';
import BlogPreview from './components/BlogPreview';
import PrivacySection from './components/PrivacySection';
import Footer from './components/Footer';

const LandingPage = () => {
  const { t, i18n } = useTranslation();
  
  // Force re-render when language changes and add debugging
  useEffect(() => {
    // This will re-render the component when language changes
    console.log(`Current language in LandingPage: ${i18n.language}`);
    
    // Add data-i18n attributes to help with debugging
    const applyI18nAttributes = () => {
      document.querySelectorAll('.container h1, .container h2, .container h3, .container p, .container button, .container a').forEach((el, index) => {
        if (!el.hasAttribute('data-i18n-key') && !el.hasAttribute('data-i18n-section')) {
          el.setAttribute('data-i18n-auto', `landing-${index}`);
        }
      });
    };
    
    // Apply attributes when language changes
    applyI18nAttributes();
    
    // Set up listener for any manual language changes
    document.addEventListener('languageChanged', applyI18nAttributes);
    
    return () => {
      document.removeEventListener('languageChanged', applyI18nAttributes);
    };
  }, [i18n.language]);
  
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
      title: t('feature1.title'),
      description: t('feature1.description')
    },
    {
      icon: Brain,
      title: t('feature2.title'),
      description: t('feature2.description')
    },
    {
      icon: LineChart,
      title: t('feature3.title'),
      description: t('feature3.description')
    },
    {
      icon: MessageSquare,
      title: t('feature4.title'),
      description: t('feature4.description')
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
      <Navbar />
      
      {/* Hero Section */}
      <motion.section
        className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden px-4"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        data-i18n-section="landing-hero"
      >
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <motion.div className="w-full md:w-1/2 text-center md:text-left" variants={itemVariants}>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block" data-i18n-key="hero.welcome">
                {t('hero.welcome')}
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4" data-i18n-key="hero.tagline">
                {t('hero.tagline')}
              </h1>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button size="lg" className="group">
                  <span data-i18n-key="navbar.download">{t('navbar.download')}</span>
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/blog" data-i18n-key="navbar.blog">{t('navbar.blog')}</Link>
                </Button>
              </div>
            </motion.div>
            
            <motion.div 
              className="w-full md:w-1/2 flex justify-center md:justify-end"
              variants={itemVariants}
            >
              <div className="relative w-full max-w-sm">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-card backdrop-blur-sm border border-primary/10 rounded-2xl p-6 shadow-xl overflow-hidden">
                  <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
                  <img 
                    src="/lovable-uploads/586c1ed2-eaed-4063-a18d-500e7085909d.png" 
                    alt="SOULo App Screenshot" 
                    className="w-full rounded-lg shadow-lg relative z-10"
                  />
                </div>
              </div>
            </motion.div>
          </div>
          
          <motion.div 
            className="absolute bottom-10 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 cursor-pointer"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            onClick={scrollToFeatures}
          >
            <span className="text-sm text-muted-foreground" data-i18n-key="hero.exploreMore">{t('hero.exploreMore')}</span>
            <ChevronDown className="animate-bounce" />
          </motion.div>
        </div>
      </motion.section>
      
      {/* Main Tagline */}
      <section className="py-12 md:py-16 bg-primary/5 backdrop-blur-sm" data-i18n-section="landing-tagline">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-medium max-w-4xl mx-auto" data-i18n-key="homepage.expressReflectGrow">
            {t('homepage.expressReflectGrow')}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto" data-i18n-key="mainTagline">
            {t('mainTagline')}
          </p>
        </div>
      </section>
      
      {/* Features Grid */}
      <section id="features" className="py-16 md:py-24" data-i18n-section="landing-features">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block" data-i18n-key="homepage.appFeatures">
              {t('homepage.appFeatures')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-i18n-key="features.title">{t('features.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" data-i18n-key="features.subtitle">
              {t('features.subtitle')}
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
                data-feature-index={index}
              >
                <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2" data-i18n-key={`feature${index+1}.title`}>{feature.title}</h3>
                <p className="text-muted-foreground" data-i18n-key={`feature${index+1}.description`}>{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Process: How It Works */}
      <section className="py-16 md:py-24 bg-primary/5" data-i18n-section="landing-process">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block" data-i18n-key="homepage.process.title">
              {t('homepage.process.title')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" data-i18n-key="features.title">{t('features.title')}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2" data-i18n-key="homepage.process.step1Title">{t('homepage.process.step1Title')}</h3>
              <p className="text-muted-foreground" data-i18n-key="homepage.process.step1Description">{t('homepage.process.step1Description')}</p>
            </motion.div>
            
            <motion.div 
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2" data-i18n-key="homepage.process.step2Title">{t('homepage.process.step2Title')}</h3>
              <p className="text-muted-foreground" data-i18n-key="homepage.process.step2Description">{t('homepage.process.step2Description')}</p>
            </motion.div>
            
            <motion.div 
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <LineChart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2" data-i18n-key="homepage.process.step3Title">{t('homepage.process.step3Title')}</h3>
              <p className="text-muted-foreground" data-i18n-key="homepage.process.step3Description">{t('homepage.process.step3Description')}</p>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Privacy Section */}
      <PrivacySection />
      
      {/* Testimonials Section */}
      <section className="py-16 md:py-24 bg-primary/5" data-i18n-section="landing-testimonials">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block" data-i18n-key="homepage.testimonials.title">
              {t('homepage.testimonials.title')}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-i18n-key="homepage.testimonials.title">{t('homepage.testimonials.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" data-i18n-key="homepage.testimonials.subtitle">
              {t('homepage.testimonials.subtitle')}
            </p>
          </div>
          
          <Testimonials />
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-16 md:py-24" data-i18n-section="landing-cta">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="bg-primary/10 rounded-3xl p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-i18n-key="homepage.cta.title">{t('homepage.cta.title')}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8" data-i18n-key="homepage.cta.description">
              {t('homepage.cta.description')}
            </p>
            <Button size="lg" className="group">
              <span data-i18n-key="homepage.cta.buttonText">{t('homepage.cta.buttonText')}</span>
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;
