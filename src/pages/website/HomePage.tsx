import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Apple, Play, Shield, Brain, Mic, MessageSquare, LineChart, ArrowRight, Check, Mail, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselDots,
} from "@/components/ui/carousel";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Navbar from '@/components/website/Navbar';
import SouloLogo from '@/components/SouloLogo';
import Footer from '@/components/website/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const PhoneVoiceAnimation = () => {
  const [animationStage, setAnimationStage] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const maxStages = 3;

  useEffect(() => {
    const generateWaveform = () => {
      const newWaveform = Array.from({ length: 30 }, () => 
        Math.random() * 0.8 + 0.2
      );
      setWaveform(newWaveform);
    };

    const interval = setInterval(() => {
      setAnimationStage((prev) => (prev + 1) % maxStages);
      
      if (animationStage === 0) {
        generateWaveform();
        setInsights([]);
      } else if (animationStage === 1) {
        setInsights([]);
      } else if (animationStage === 2) {
        setInsights([
          "Feeling optimistic about new project",
          "Stress levels decreasing compared to last week",
          "Sleep pattern improving"
        ]);
      }
    }, 3000);

    generateWaveform();

    return () => clearInterval(interval);
  }, [animationStage]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="relative w-64 h-[500px] bg-gray-900 rounded-[40px] overflow-hidden border-8 border-gray-800 shadow-xl">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col">
          <div className="h-14 bg-gradient-to-r from-primary/80 to-purple-600/80 flex items-center justify-center">
            <SouloLogo size="small" useColorTheme={true} />
          </div>
          <div className="flex-1 p-4 flex flex-col">
            {animationStage === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="text-white text-center mb-6">
                  <p className="text-sm mb-2">Recording your journal...</p>
                </div>
                <div className="w-full h-24 flex items-center justify-center gap-1 mb-8">
                  {waveform.map((height, index) => (
                    <motion.div
                      key={index}
                      className="w-1.5 bg-primary rounded-full"
                      initial={{ height: 4 }}
                      animate={{ 
                        height: `${height * 80}px`,
                        opacity: height
                      }}
                      transition={{
                        duration: 0.2,
                        repeat: Infinity,
                        repeatType: "reverse",
                        delay: index * 0.02
                      }}
                    />
                  ))}
                </div>
                <motion.div 
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-4"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  <Mic className="h-8 w-8 text-white" />
                </motion.div>
              </motion.div>
            )}
            {animationStage === 1 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                <div className="text-white text-center mb-8">
                  <p className="text-sm mb-2">Processing your entry...</p>
                </div>
                <motion.div 
                  className="w-20 h-20 rounded-full bg-purple-600/30 flex items-center justify-center"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 360],
                    borderRadius: ["50%", "40%", "50%"]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Brain className="h-10 w-10 text-purple-400" />
                </motion.div>
                <div className="mt-8 flex gap-2">
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: 0
                    }}
                  />
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: 0.3
                    }}
                  />
                  <motion.div 
                    className="w-3 h-3 rounded-full bg-primary"
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "loop",
                      delay: 0.6
                    }}
                  />
                </div>
              </motion.div>
            )}
            {animationStage === 2 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                <h3 className="text-white text-center mb-4 text-sm">Your Journal Insights</h3>
                <div className="space-y-3">
                  {insights.map((insight, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.3 }}
                      className="bg-gray-800/80 p-3 rounded-lg border border-gray-700"
                    >
                      <div className="flex gap-2">
                        <div className="min-w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                          <LineChart className="h-3 w-3 text-primary" />
                        </div>
                        <p className="text-white text-xs">{insight}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <motion.div 
                  className="mt-auto mb-4 w-full bg-primary/20 p-3 rounded-lg flex items-center justify-between"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  <p className="text-primary text-xs">View full analysis</p>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </motion.div>
              </motion.div>
            )}
          </div>
          <div className="h-16 border-t border-gray-800 flex justify-around items-center px-4">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <LineChart className="h-5 w-5 text-white" />
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/20 filter blur-3xl -z-10"></div>
      <div className="absolute top-1/3 left-1/3 w-40 h-40 rounded-full bg-purple-500/20 filter blur-2xl -z-10"></div>
      {animationStage === 2 && (
        <>
          {Array.from({ length: 8 }).map((_, index) => (
            <motion.div
              key={index}
              className="absolute w-2 h-2 rounded-full bg-primary/60"
              initial={{ 
                top: "60%", 
                left: "50%", 
                scale: 0,
                opacity: 0.8 
              }}
              animate={{ 
                top: `${30 + Math.random() * 30}%`,
                left: `${30 + Math.random() * 40}%`,
                scale: Math.random() * 0.5 + 0.5,
                opacity: 0
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                repeatType: "loop",
                delay: index * 0.3
              }}
            />
          ))}
        </>
      )}
    </div>
  );
};

const HomePage = () => {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [activeFeature, setActiveFeature] = useState(0);
  const [pricingMode, setPricingMode] = useState('monthly');
  const [activeProcessStep, setActiveProcessStep] = useState(0);
  
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
    console.log('Email submitted:', email);
    setEmail('');
    alert('Thanks for subscribing!');
  };

  const features = [
    {
      title: "Voice Journaling",
      description: "Record your thoughts with voice and let SOuLO transcribe and analyze them automatically.",
      icon: Mic,
      image: "https://images.unsplash.com/photo-1589254065878-42c9da997008?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
    },
    {
      title: "AI Analysis",
      description: "Gain insights into your patterns and emotions through advanced AI analysis.",
      icon: Brain,
      image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
    },
    {
      title: "Emotional Tracking",
      description: "Visualize your emotional journey over time with interactive charts.",
      icon: LineChart,
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
    },
    {
      title: "AI Assistant",
      description: "Chat with your journal and get personalized insights from your past entries.",
      icon: MessageSquare,
      image: "https://images.unsplash.com/photo-1577563908411-5077b6dc7624?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
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

  const processSteps = [
    {
      step: "1",
      title: "Record Your Thoughts",
      description: [
        "Speak freely in any language about your day, feelings, or thoughts",
        "Works even in noisy environments and understands multiple languages",
        "No writing required - just talk naturally as you would to a friend",
        "Automatic transcription saves your spoken words into text format"
      ],
      image: "/lovable-uploads/eb66a92e-1044-4a85-9380-4790da9cf683.png",
      icon: Mic
    },
    {
      step: "2",
      title: "AI Analyzes Your Entry",
      description: [
        "Our AI transcribes your voice and analyzes emotional patterns and themes",
        "Automatically recognizes key entities like people, places, and things",
        "Creates searchable tags to help you easily filter and find past entries",
        "Identifies recurring themes and patterns in your journaling"
      ],
      image: "/lovable-uploads/185c449b-b8f9-435d-b91b-3638651c0d06.png",
      icon: Brain
    },
    {
      step: "3a",
      title: "Analyze Your Emotional Patterns",
      description: [
        "Filter insights using customizable time ranges (day, week, month, year)",
        "See your dominant moods and what emotions appear most in your entries",
        "Track your biggest emotional changes and their intensity over time",
        "View your journaling activity stats and streaks"
      ],
      images: [
        "/lovable-uploads/d61c0a45-1846-4bde-b495-f6b8c58a2951.png",
        "/lovable-uploads/86f40c9c-bea5-4d03-9eb3-7336786f1bbb.png", 
        "/lovable-uploads/71907497-c7a1-4288-9799-bbd229b480ad.png"
      ],
      icon: LineChart,
      multiplePhones: true
    },
    {
      step: "3b",
      title: "Visualize Your Emotional Journey",
      description: [
        "See graphical representations of emotion score movements over time",
        "Explore emotional bubbles that define your personality and their intensities",
        "View your overall sentiment changes in interactive calendar format",
        "Identify patterns in your mood with color-coded visual guides"
      ],
      images: [
        "/lovable-uploads/3eeb2da1-ba02-4cd6-b5f7-100f72896921.png",
        "/lovable-uploads/1b346540-75b4-4095-8860-2446c46aea4c.png"
      ],
      icon: Calendar,
      multiplePhones: true
    },
    {
      step: "4",
      title: "Chat with Your Journal",
      description: [
        "Have a conversation with \"Rūḥ\", an emotionally intelligent AI assistant",
        "Ask questions about your past entries and get insightful responses",
        "Receive personalized guidance specific to your own journal entries",
        "Get contextual advice on mental health and emotional wellbeing"
      ],
      image: "/lovable-uploads/1c377509-f91d-4c41-9289-dc867a89a90e.png",
      icon: MessageSquare
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

  const nextProcessStep = () => {
    setActiveProcessStep((prev) => (prev + 1) % processSteps.length);
  };

  const prevProcessStep = () => {
    setActiveProcessStep((prev) => (prev - 1 + processSteps.length) % processSteps.length);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextFeature();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
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
                Express. Reflect. <span className="text-primary">Grow.</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto lg:mx-0">
                Journaling should be as simple as talking. Use voice and leave the rest to us.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <Button 
                  size="lg" 
                  className="gap-2 bg-black text-white hover:bg-gray-800" 
                  onClick={openAppStore}
                >
                  <Apple className="h-5 w-5" />
                  <span>App Store</span>
                </Button>
                <Button 
                  size="lg" 
                  className="gap-2 bg-primary hover:bg-primary/90" 
                  onClick={openPlayStore}
                >
                  <Play className="h-5 w-5" />
                  <span>Google Play</span>
                </Button>
              </div>
              
              <div className="flex items-center justify-center lg:justify-start gap-8 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Privacy-Focused</span>
                </div>
                <div className="flex items-center gap-1">
                  <Check className="h-4 w-4 text-primary" />
                  <span>14-Day Free Trial</span>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="w-full lg:w-1/2 flex items-center justify-center"
            >
              <div className="relative max-w-md w-full h-[500px]">
                <PhoneVoiceAnimation />
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">App Features</span>
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
                      <img 
                        src={features[activeFeature].image} 
                        alt={features[activeFeature].title} 
                        className="w-full h-auto"
                      />
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
      
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Process</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Start your self-discovery journey with these simple steps
            </p>
          </div>
          
          <Carousel 
            className="w-full max-w-5xl mx-auto"
            setActiveItem={setActiveProcessStep}
          >
            <CarouselContent>
              {processSteps.map((item, i) => (
                <CarouselItem key={i} className="md:basis-full">
                  <div className="p-1">
                    <div className="flex flex-col md:flex-row items-center gap-8 p-4">
                      <div className="w-full md:w-1/2 text-center md:text-left order-2 md:order-1">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary">{item.step}</span>
                          </div>
                          <h3 className="text-2xl font-bold">{item.title}</h3>
                        </div>
                        <ul className="text-muted-foreground mb-6 space-y-2 list-disc pl-5">
                          {item.description.map((point, index) => (
                            <li key={index} className="text-left">{point}</li>
                          ))}
                        </ul>
                        <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto md:mx-0">
                          {React.createElement(item.icon, { className: "h-6 w-6 text-primary" })}
                        </div>
                      </div>
                      
                      <div className="w-full md:w-1/2 order-1 md:order-2">
                        {item.multiplePhones ? (
                          <div className="flex flex-wrap justify-center gap-2">
                            {item.images && item.images.map((img, idx) => (
                              <div key={idx} className="relative w-[30%]">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-3xl blur-xl"></div>
                                <div className="relative">
                                  <div className="bg-white w-full aspect-[9/19] min-h-[230px] mx-auto rounded-[24px] overflow-hidden border-[4.8px] border-gray-800 shadow-xl relative">
                                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[30%] h-[1.5%] bg-black rounded-b-xl z-10"></div>
                                    <img 
                                      src={img} 
                                      alt={`${item.title} - Phone ${idx+1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="relative max-w-xs mx-auto">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-3xl blur-xl"></div>
                            <div className="relative">
                              <div className="bg-white w-full aspect-[9/19] mx-auto rounded-[24px] overflow-hidden border-[4.8px] border-gray-800 shadow-xl relative">
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[30%] h-[1.5%] bg-black rounded-b-xl z-10"></div>
                                <img 
                                  src={item.image} 
                                  alt={item.title} 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            
            <div className="flex justify-center gap-4 mt-8">
              <CarouselPrevious className="relative -left-0 top-0 translate-y-0 mx-2" />
              <CarouselDots count={processSteps.length} className="flex gap-2" />
              <CarouselNext className="relative -right-0 top-0 translate-y-0 mx-2" />
            </div>
          </Carousel>
        </div>
      </section>
      
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Privacy</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Privacy is Our Priority</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              At SOuLO, we believe that your personal thoughts and feelings should remain private. 
              We've built our platform with privacy at its core.
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-12 justify-center">
            <motion.div 
              className="w-full md:w-[35%]"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="bg-black text-white p-6 rounded-xl shadow-lg">
                <ul className="space-y-3">
                  {[
                    "End-to-end encryption for all your journal entries",
                    "Your data never leaves your personal space",
                    "No third-party access to your personal insights",
                    "Complete control over what you share",
                    "Option to delete all your data at any time"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Button variant="outline" asChild className="gap-2 bg-transparent text-white border-white hover:bg-white/10">
                    <a href="/privacy-policy">
                      Learn More About Our Privacy
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="w-full md:w-[35%]"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <img 
                src="/lovable-uploads/2ca17c6f-5994-4559-a86c-7dcac6672b6c.png" 
                alt="Privacy-focused design" 
                className="w-full h-auto rounded-xl shadow-lg"
              />
            </motion.div>
          </div>
        </div>
      </section>
      
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
            {[
              {
                text: "SOuLO has completely transformed how I reflect on my day. The voice journaling feature saves me so much time!",
                author: "Sarah K., Designer",
                avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
              },
              {
                text: "As someone who struggles with writing, being able to speak my thoughts and have them analyzed is incredible.",
                author: "Michael T., Engineer",
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
              },
              {
                text: "The emotional insights I get from SOuLO have helped me understand my patterns and make positive changes.",
                author: "Jamie L., Therapist",
                avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80"
              }
            ].map((testimonial, i) => (
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
                      <span className="text-gray-600">AI chat assistant</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-gray-600">Priority support</span>
                    </li>
                  </ul>
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                  >
                    Start Free Trial
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
      
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about SOuLO
            </p>
          </div>
          
          <div className="space-y-6">
            {[
              {
                question: "How does voice journaling work?",
                answer: "SOuLO makes it easy to capture your thoughts by speaking. Just open the app, tap the record button, and speak freely. Our AI will transcribe your voice and analyze the content for emotional patterns and key themes."
              },
              {
                question: "Is my data private and secure?",
                answer: "Absolutely. Your privacy is our top priority. All your journal entries are end-to-end encrypted, and you have complete control over what you share. We do not sell or share your data with third parties."
              },
              {
                question: "Can I use SOuLO without internet connection?",
                answer: "Yes, you can record your journal entries offline. They will be stored locally on your device and will sync with our servers when you reconnect to the internet."
              },
              {
                question: "What languages does SOuLO support?",
                answer: "Currently, SOuLO supports English, Spanish, French, German, and Japanese. We're continuously working to add more languages."
              },
              {
                question: "Can I cancel my subscription anytime?",
                answer: "Yes, you can cancel your subscription at any time. Your premium features will remain active until the end of your billing period."
              }
            ].map((faq, i) => (
              <motion.div 
                key={i} 
                className="bg-gray-50 rounded-lg p-6"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <h3 className="text-xl font-medium mb-3">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">Don't see your question here?</p>
            <Button asChild>
              <a href="/faq">View All FAQs</a>
            </Button>
          </div>
        </div>
      </section>
      
      <section id="download-section" className="py-16 md:py-24 bg-gradient-to-br from-primary/10 to-purple-100">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Start Your Self-Discovery Journey?</h2>
          <p className="text-xl text-gray-700 mb-8">
            Join thousands of people who have transformed their self-reflection practice with SOuLO.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="gap-2 bg-black text-white hover:bg-gray-800" 
              onClick={openAppStore}
            >
              <Apple className="h-5 w-5" />
              <span>App Store</span>
            </Button>
            <Button 
              size="lg" 
              className="gap-2 bg-primary hover:bg-primary/90" 
              onClick={openPlayStore}
            >
              <Play className="h-5 w-5" />
              <span>Google Play</span>
            </Button>
          </div>
          
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium mb-4">Stay updated with our newsletter</h3>
            <form onSubmit={handleEmailSubmit} className="flex gap-2">
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" className="gap-2">
                Subscribe
                <Mail className="h-4 w-4" />
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
