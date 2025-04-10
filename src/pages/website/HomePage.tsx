import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Apple, 
  Play, 
  Shield, 
  Brain, 
  Mic, 
  MessageSquare, 
  LineChart, 
  ArrowRight, 
  Check, 
  Mail,
  AudioWaveform,
  Sparkles,
  BarChart3,
  MessagesSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/website/Navbar';
import SouloLogo from '@/components/SouloLogo';
import Footer from '@/components/website/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const HomePage = () => {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [activeFeature, setActiveFeature] = useState(0);
  const [pricingMode, setPricingMode] = useState('monthly');
  const { translate } = useLanguage();
  
  const openAppStore = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const appStoreUrl = 'https://apps.apple.com/app/soulo';
    
    if (isIOS) {
      window.location.href = 'itms-apps://itunes.apple.com/app/soulo';
      setTimeout(() => {
        window.location.href = appStoreUrl;
      }, 500);
    } else {
      window.open(appStoreUrl, '_blank');
    }
  };

  const openPlayStore = () => {
    const isAndroid = /Android/.test(navigator.userAgent);
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.soulo.app';
    
    if (isAndroid) {
      window.location.href = 'market://details?id=com.soulo.app';
      setTimeout(() => {
        window.location.href = playStoreUrl;
      }, 500);
    } else {
      window.open(playStoreUrl, '_blank');
    }
  };
  
  const handleEmailSubmit = (e) => {
    e.preventDefault();
    // Handle newsletter signup
    console.log('Email submitted:', email);
    // Clear the input
    setEmail('');
    // Show success message
    alert('Thanks for subscribing!');
  };

  const features = [
    {
      title: translate('features.voiceJournaling.title', "Voice Journaling"),
      description: translate('features.voiceJournaling.description', "Record your thoughts with voice and let SOuLO transcribe and analyze them automatically."),
      icon: AudioWaveform,
    },
    {
      title: translate('features.aiAnalysis.title', "AI Analysis"),
      description: translate('features.aiAnalysis.description', "Gain insights into your patterns and emotions through advanced AI analysis."),
      icon: Sparkles,
    },
    {
      title: translate('features.emotionalTracking.title', "Emotional Tracking"),
      description: translate('features.emotionalTracking.description', "Visualize your emotional journey over time with interactive charts."),
      icon: BarChart3,
    },
    {
      title: translate('features.aiAssistant.title', "AI Assistant"),
      description: translate('features.aiAssistant.description', "Chat with your journal and get personalized insights from your past entries."),
      icon: MessagesSquare,
    }
  ];

  const testimonials = [
    {
      text: "SOuLO has completely transformed how I reflect on my day. The voice journaling feature saves me so much time!",
      author: "Sarah K., Designer",
      avatar: "/lovable-uploads/69a98431-43ec-41e5-93f1-7ddaf28e2884.png"
    },
    {
      text: "As someone who struggles with writing, being able to speak my thoughts and have them analyzed is incredible.",
      author: "Michael T., Engineer",
      avatar: "/lovable-uploads/5b18686b-4a3c-4341-a072-479db470ac1d.png"
    },
    {
      text: "The emotional insights I get from SOuLO have helped me understand my patterns and make positive changes.",
      author: "Jamie L., Therapist",
      avatar: "/lovable-uploads/cb710491-93f0-42be-a596-f64d80d9800e.png"
    }
  ];

  const getPricingDetails = (plan) => {
    if (pricingMode === 'monthly') {
      return { 
        usd: "$5",
        inr: "₹99",
        period: "per month"
      };
    } else if (pricingMode === 'yearly') {
      return { 
        usd: "$48", // $5 * 12 - 20% discount = $48
        inr: "₹950", // ₹99 * 12 - 20% discount ~ ₹950
        period: "per year",
        discount: "Save 20%"
      };
    } else if (pricingMode === 'lifetime') {
      return { 
        usd: "$200",
        inr: "₹2,000",
        period: "one-time payment",
        discount: "Best value"
      };
    }
  };

  const nextFeature = () => {
    setActiveFeature((prev) => (prev + 1) % features.length);
  };

  const prevFeature = () => {
    setActiveFeature((prev) => (prev - 1 + features.length) % features.length);
  };

  useEffect(() => {
    // Auto-rotate features every 5 seconds
    const interval = setInterval(() => {
      nextFeature();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const FeatureIllustration = ({ type }) => {
    if (type === "Voice Journaling") {
      return (
        <div className="relative h-64 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-blue-400/30 animate-pulse blur-xl absolute"></div>
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <AudioWaveform size={48} className="text-primary mb-4" />
            <div className="flex gap-1 items-center">
              <div className="h-10 w-1 bg-blue-500 animate-[pulse_1s_ease-in-out_infinite] rounded-full"></div>
              <div className="h-16 w-1 bg-blue-500 animate-[pulse_0.7s_ease-in-out_infinite] rounded-full"></div>
              <div className="h-12 w-1 bg-blue-500 animate-[pulse_0.8s_ease-in-out_infinite] rounded-full"></div>
              <div className="h-20 w-1 bg-blue-500 animate-[pulse_0.6s_ease-in-out_infinite] rounded-full"></div>
              <div className="h-14 w-1 bg-blue-500 animate-[pulse_0.9s_ease-in-out_infinite] rounded-full"></div>
              <div className="h-10 w-1 bg-blue-500 animate-[pulse_1s_ease-in-out_infinite] rounded-full"></div>
              <div className="h-8 w-1 bg-blue-500 animate-[pulse_0.7s_ease-in-out_infinite] rounded-full"></div>
            </div>
            <div className="mt-4 p-2 bg-white/80 backdrop-blur-sm rounded-md border border-blue-100">
              <p className="text-sm text-blue-800">Voice → Text Conversion</p>
            </div>
          </div>
        </div>
      );
    } else if (type === "AI Analysis") {
      return (
        <div className="relative h-64 bg-gradient-to-br from-purple-50 to-pink-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-purple-400/30 animate-pulse blur-xl absolute"></div>
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-3">
              <Brain size={48} className="text-purple-600" />
              <Sparkles size={20} className="text-yellow-500 absolute -top-2 -right-2" />
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-xs">
              {['Joy', 'Growth', 'Stress', 'Family', 'Health'].map((tag, i) => (
                <span 
                  key={tag} 
                  className="px-2 py-1 bg-white/80 rounded-full text-xs border border-purple-200 text-purple-700"
                  style={{ 
                    animationDelay: `${i * 0.1}s`, 
                    animation: 'pulse 2s infinite' 
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-4 p-2 bg-white/80 backdrop-blur-sm rounded-md border border-purple-100">
              <p className="text-sm text-purple-800">Pattern Recognition</p>
            </div>
          </div>
        </div>
      );
    } else if (type === "Emotional Tracking") {
      return (
        <div className="relative h-64 bg-gradient-to-br from-green-50 to-teal-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-teal-400/30 animate-pulse blur-xl absolute"></div>
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <BarChart3 size={48} className="text-teal-600 mb-4" />
            <div className="w-64 h-24 bg-white/80 backdrop-blur-sm rounded-lg p-2 flex items-end">
              <div className="w-8 h-10 bg-teal-300 rounded-t-md mx-1"></div>
              <div className="w-8 h-16 bg-teal-400 rounded-t-md mx-1"></div>
              <div className="w-8 h-8 bg-teal-300 rounded-t-md mx-1"></div>
              <div className="w-8 h-14 bg-teal-500 rounded-t-md mx-1"></div>
              <div className="w-8 h-20 bg-teal-600 rounded-t-md mx-1"></div>
              <div className="w-8 h-12 bg-teal-400 rounded-t-md mx-1"></div>
            </div>
            <div className="mt-4 p-2 bg-white/80 backdrop-blur-sm rounded-md border border-teal-100">
              <p className="text-sm text-teal-800">Emotion Trend Analysis</p>
            </div>
          </div>
        </div>
      );
    } else if (type === "AI Assistant") {
      return (
        <div className="relative h-64 bg-gradient-to-br from-amber-50 to-orange-100 rounded-lg overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-amber-400/30 animate-pulse blur-xl absolute"></div>
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <MessagesSquare size={48} className="text-amber-600 mb-4" />
            <div className="flex flex-col gap-2">
              <div className="bg-white/80 backdrop-blur-sm p-2 rounded-lg text-left text-sm">
                <p className="text-gray-800">How have I been feeling lately?</p>
              </div>
              <div className="bg-amber-500/90 backdrop-blur-sm p-2 rounded-lg text-white text-left text-sm">
                <p>Based on your entries, you've been feeling more positive this week!</p>
              </div>
            </div>
            <div className="mt-4 p-2 bg-white/80 backdrop-blur-sm rounded-md border border-amber-100">
              <p className="text-sm text-amber-800">Personalized Insights</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative w-full bg-gradient-to-br from-blue-50 to-purple-50 pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/lovable-uploads/32abc730-009c-4901-912c-a16e7c2c1ec6.png')" }}
        ></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="w-full lg:w-1/2 text-center lg:text-left"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-primary">
                {translate('hero.title', 'Express. Reflect. Grow.')}
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto lg:mx-0">
                {translate('hero.subtitle', 'Journaling should be as simple as talking. Use voice and leave the rest to us.')}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Button 
                  size="lg" 
                  className="gap-2 bg-black text-white hover:bg-gray-800" 
                  onClick={openAppStore}
                >
                  <Apple className="h-5 w-5" />
                  <span>{translate('app.appStore', 'App Store')}</span>
                </Button>
                <Button 
                  size="lg" 
                  className="gap-2 bg-primary hover:bg-primary/90" 
                  onClick={openPlayStore}
                >
                  <Play className="h-5 w-5" />
                  <span>{translate('app.googlePlay', 'Google Play')}</span>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  asChild
                >
                  <a href="/app">{translate('app.tryWebApp', 'Try Web App')}</a>
                </Button>
              </div>
              
              <div className="flex items-center justify-center lg:justify-start gap-8 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>{translate('app.privacyFocused', 'Privacy-Focused')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{translate('app.freeTrial', '14-Day Free Trial')}</span>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="w-full lg:w-1/2"
            >
              <div className="relative mx-auto max-w-md">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
                <div className="relative overflow-hidden shadow-2xl border border-white/50 rounded-xl bg-black">
                  <div className="w-full h-auto relative pt-[100%]">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 rounded-full bg-blue-500/30 animate-pulse blur-xl absolute"></div>
                      <div className="w-24 h-24 rounded-full bg-purple-500/30 animate-pulse blur-xl absolute"></div>
                    </div>
                    
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <div className="relative w-60 h-60">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-48 rounded-3xl border-2 border-blue-400/80 bg-slate-900/50"></div>
                        
                        <div className="absolute top-[25%] left-1/2 transform -translate-x-1/2 w-28 h-20 rounded-full">
                          <div className="absolute inset-0 bg-blue-500/20 animate-pulse rounded-full blur-lg"></div>
                          <div className="absolute inset-0 bg-blue-400/30 rounded-full"></div>
                          <div className="absolute inset-2 bg-blue-300/30 rounded-full"></div>
                          <div className="absolute inset-4 bg-blue-200/30 rounded-full animate-pulse"></div>
                        </div>
                        
                        <div className="absolute top-[42%] left-[35%] w-3 h-3 rounded-full bg-blue-400 shadow-lg shadow-blue-400/70 animate-pulse"></div>
                        <div className="absolute top-[42%] left-[58%] w-3 h-3 rounded-full bg-blue-400 shadow-lg shadow-blue-400/70 animate-pulse"></div>
                        
                        <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 w-14 h-14">
                          <div className="absolute inset-0 bg-purple-500/40 animate-pulse rounded-full blur-lg"></div>
                          <div className="absolute inset-1 bg-purple-400/40 rounded-full animate-[pulse_3s_ease-in-out_infinite]"></div>
                          <div className="absolute inset-3 bg-purple-300/30 rounded-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                          <div className="absolute inset-5 bg-white/90 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></div>
                        </div>
                        
                        <div className="absolute inset-0 opacity-80">
                          <div className="absolute top-[45%] left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[pulse_2s_ease-in-out_infinite]"></div>
                          <div className="absolute top-[55%] left-[25%] right-[25%] h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-[pulse_2.5s_ease-in-out_infinite]"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute bottom-5 left-0 right-0 text-center text-white text-xs font-mono opacity-80">
                      <div className="inline-block border border-blue-400/30 bg-black/50 px-2 py-1 rounded-md">
                        <span className="animate-pulse">AI</span> × <span className="text-purple-300">Soul</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* App Features Carousel */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">
              App Features
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Discover SOuLO's Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our innovative approach combines voice journaling with AI technology to provide you with meaningful insights about yourself.
            </p>
          </div>
          
          <div className="relative max-w-5xl mx-auto">
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="icon" 
                className="absolute left-0 z-10 rounded-full"
                onClick={prevFeature}
              >
                <ArrowRight className="h-6 w-6 rotate-180" />
              </Button>
              
              <div className="w-full overflow-hidden py-8">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <motion.div 
                    key={activeFeature}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.5 }}
                    className="w-full md:w-1/2 p-4"
                  >
                    <div className="overflow-hidden border-primary/10 shadow-lg bg-white rounded-xl">
                      <FeatureIllustration type={features[activeFeature].title} />
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    key={`text-${activeFeature}`}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="w-full md:w-1/2 p-4 text-center md:text-left"
                  >
                    <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mb-6 mx-auto md:mx-0">
                      {React.createElement(features[activeFeature].icon, { className: "h-8 w-8 text-primary" })}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-4">{features[activeFeature].title}</h3>
                    <p className="text-muted-foreground text-lg">{features[activeFeature].description}</p>
                  </motion.div>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="icon" 
                className="absolute right-0 z-10 rounded-full"
                onClick={nextFeature}
              >
                <ArrowRight className="h-6 w-6" />
              </Button>
            </div>
            
            <div className="flex justify-center gap-2 mt-8">
              {features.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full ${index === activeFeature ? 'bg-primary' : 'bg-gray-300'}`}
                  onClick={() => setActiveFeature(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* How It Works Section with Icon-based Process Steps */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Process</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start your self-discovery journey in three simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                title: "Record Your Thoughts",
                description: "Speak freely about your day, feelings, or any thoughts you want to capture. No writing required!",
                icon: <Mic size={64} className="text-primary"/>
              },
              {
                step: "2",
                title: "AI Analyzes Your Entry",
                description: "Our AI transcribes your voice and analyzes the emotional patterns and key themes in your entry.",
                icon: <Brain size={64} className="text-primary"/>
              },
              {
                step: "3",
                title: "Gain Personalized Insights",
                description: "Discover patterns, track emotional trends over time, and get personalized insights to support your growth.",
                icon: <Sparkles size={64} className="text-primary"/>
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
              >
                <div className="relative mb-6">
                  <div className="absolute -inset-1 bg-primary/20 rounded-full blur-lg"></div>
                  <div className="bg-white w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center text-2xl font-bold text-primary relative">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground mb-6">{item.description}</p>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-lg border border-gray-200 shadow-sm">
                  {item.icon}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Privacy Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <motion.div 
              className="w-full md:w-1/2"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <Shield className="h-12 w-12 text-primary mb-6" />
                <h2 className="text-3xl font-bold mb-4">Your Privacy is Our Priority</h2>
                <p className="text-lg text-gray-600 mb-6">
                  At SOuLO, we believe that your personal thoughts and feelings should remain private. 
                  We've built our platform with privacy at its core.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "End-to-end encryption for all your journal entries",
                    "Your data never leaves your personal space",
                    "No third-party access to your personal insights",
                    "Complete control over what you share",
                    "Option to delete all your data at any time"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" asChild className="gap-2">
                  <a href="/privacy-policy">
                    Learn More About Our Privacy
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </motion.div>
            
            <motion.div 
              className="w-full md:w-1/2"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <img 
                src="https://img.freepik.com/free-vector/gdpr-concept-illustration_114360-1028.jpg" 
                alt="Privacy-focused design" 
                className="w-full h-auto rounded-xl shadow-lg"
              />
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Users Say</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Join thousands of people who have transformed their self-reflection practice with SOuLO
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, i) => (
              <motion.div 
                key={i} 
                className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden">
                    <img 
                      src={testimonial.avatar} 
                      alt={testimonial.author} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium">{testimonial.author}</p>
                  </div>
                </div>
                <p className="text-gray-600 italic">"{testimonial.text}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Pricing</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your journaling needs
            </p>
          </div>
          
          <div className="mt-8">
            <Tabs defaultValue="monthly" className="w-full max-w-md mx-auto mb-12">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="monthly" onClick={() => setPricingMode('monthly')}>Monthly</TabsTrigger>
                <TabsTrigger value="yearly" onClick={() => setPricingMode('yearly')}>Yearly (Save 20%)</TabsTrigger>
                <TabsTrigger value="lifetime" onClick={() => setPricingMode('lifetime')}>Lifetime</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <motion.div 
                className="bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">Free</h3>
                  <p className="text-muted-foreground mb-6">Great for getting started with voice journaling</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$0</span>
                    <span className="text-gray-500">/forever</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Unlimited entries per week</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Basic emotion tracking</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Web app access</span>
                    </li>
                    <li className="flex items-start gap-3 opacity-50">
                      <Check className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-gray-400">No access to insights (Premium only)</span>
                    </li>
                    <li className="flex items-start gap-3 opacity-50">
                      <Check className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-gray-400">No AI chatbot (Premium only)</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full bg-white border-2 border-primary text-primary hover:bg-primary/5"
                  >
                    Get Started
                  </Button>
                </div>
              </motion.div>
              
              {/* Premium Plan */}
              <motion.div 
                className="bg-white rounded-xl overflow-hidden shadow-lg border border-primary relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <div className="bg-primary text-white text-center py-1 text-sm font-medium">
                  {pricingMode === 'yearly' ? 'Save 20%' : pricingMode === 'lifetime' ? 'Best Value' : 'Most Popular'}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">Premium</h3>
                  <p className="text-muted-foreground mb-6">Perfect for daily journaling and deeper insights</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{getPricingDetails('premium').usd}</span>
                    <span className="text-gray-500">/{getPricingDetails('premium').period}</span>
                    <div className="text-sm text-primary mt-1">Also available in INR: {getPricingDetails('premium').inr}</div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Unlimited entries per week</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Advanced emotion analytics</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Unlimited history</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">AI-powered insights</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Smart chat with your journal</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full"
                  >
                    Choose Premium
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Newsletter Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 to-purple-100">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-white text-primary text-sm font-medium mb-4 inline-block">Newsletter</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Stay Updated</h2>
            <p className="text-gray-600 mb-8">
              Subscribe to our newsletter for product updates, journaling tips, and exclusive content.
            </p>
            
            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white"
              />
              <Button type="submit">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;
