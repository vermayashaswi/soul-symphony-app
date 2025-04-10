
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Apple, Play, Shield, Brain, Mic, MessageSquare, LineChart, ArrowRight, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/website/Navbar';
import SouloLogo from '@/components/SouloLogo';
import AppFeatureCarousel from '@/components/website/AppFeatureCarousel';
import Footer from '@/components/website/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const HomePage = () => {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  
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
    // Show success message (you'd typically use a toast here)
    alert('Thanks for subscribing!');
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

  const testimonials = [
    {
      text: "SOULo has completely transformed how I reflect on my day. The voice journaling feature saves me so much time!",
      author: "Sarah K., Designer",
      avatar: "/lovable-uploads/69a98431-43ec-41e5-93f1-7ddaf28e2884.png"
    },
    {
      text: "As someone who struggles with writing, being able to speak my thoughts and have them analyzed is incredible.",
      author: "Michael T., Engineer",
      avatar: "/lovable-uploads/5b18686b-4a3c-4341-a072-479db470ac1d.png"
    },
    {
      text: "The emotional insights I get from SOULo have helped me understand my patterns and make positive changes.",
      author: "Jamie L., Therapist",
      avatar: "/lovable-uploads/cb710491-93f0-42be-a596-f64d80d9800e.png"
    }
  ];

  const pricingPlans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Great for getting started with voice journaling",
      features: [
        "5 voice entries per month",
        "Basic emotion tracking",
        "7-day insight history",
        "Web app access"
      ],
      cta: "Get Started",
      popular: false
    },
    {
      name: "Premium",
      price: "$9.99",
      period: "per month",
      description: "Perfect for daily journaling and deeper insights",
      features: [
        "Unlimited voice entries",
        "Advanced emotion analytics",
        "Unlimited history",
        "AI chat assistant",
        "Priority support"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Family",
      price: "$19.99",
      period: "per month",
      description: "Share the journey with your loved ones",
      features: [
        "Everything in Premium",
        "Up to 5 user accounts",
        "Shared insights (optional)",
        "Family trends",
        "Premium support"
      ],
      cta: "Start Free Trial",
      popular: false
    }
  ];

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
              <SouloLogo size="large" useColorTheme={true} className="mx-auto lg:mx-0 mb-4" />
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-primary">
                Express. Reflect. <span className="text-primary">Grow.</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto lg:mx-0">
                Keep a journal and capture your day without writing down a single word!
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
                <Button 
                  size="lg" 
                  variant="outline" 
                  asChild
                >
                  <a href="/app">Try Web App</a>
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
              className="w-full lg:w-1/2"
            >
              <div className="relative mx-auto max-w-md">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-2xl blur-xl"></div>
                <div className="relative bg-white rounded-xl overflow-hidden shadow-2xl border border-white/50">
                  <img 
                    src="/lovable-uploads/586c1ed2-eaed-4063-a18d-500e7085909d.png" 
                    alt="SOULo App Screenshot" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Social Proof */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-70">
            <p className="text-lg font-medium text-gray-500">Trusted by teams at:</p>
            <img src="https://via.placeholder.com/120x40" alt="Company 1" className="h-8" />
            <img src="https://via.placeholder.com/120x40" alt="Company 2" className="h-8" />
            <img src="https://via.placeholder.com/120x40" alt="Company 3" className="h-8" />
            <img src="https://via.placeholder.com/120x40" alt="Company 4" className="h-8" />
          </div>
        </div>
      </section>
      
      {/* Features Grid */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">Features</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How SOULo Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our innovative approach combines voice journaling with AI technology to provide you with meaningful insights about yourself.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div 
                key={index}
                className="bg-white border border-primary/10 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
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
      
      {/* App Features Carousel */}
      <AppFeatureCarousel />
      
      {/* How It Works Section */}
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
                image: "/lovable-uploads/f1035a0b-8b30-4d38-9234-6560a14558de.png"
              },
              {
                step: "2",
                title: "AI Analyzes Your Entry",
                description: "Our AI transcribes your voice and analyzes the emotional patterns and key themes in your entry.",
                image: "/lovable-uploads/a6374f0f-2e81-45f4-8c42-dfe81f7fbf01.png"
              },
              {
                step: "3",
                title: "Gain Personalized Insights",
                description: "Discover patterns, track emotional trends over time, and get personalized insights to support your growth.",
                image: "/lovable-uploads/8dd08973-e7a2-4bef-a990-1e3ff0dede92.png"
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
                <div className="relative w-full max-w-xs mx-auto rounded-lg overflow-hidden shadow-md">
                  <img src={item.image} alt={item.title} className="w-full h-auto" />
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
                  At SOULo, we believe that your personal thoughts and feelings should remain private. 
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
                src="/lovable-uploads/32abc730-009c-4901-912c-a16e7c2c1ec6.png" 
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
              Join thousands of people who have transformed their self-reflection practice with SOULo
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
                      src={testimonial.avatar || "https://via.placeholder.com/48"} 
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly (Save 20%)</TabsTrigger>
              </TabsList>
              <TabsContent value="monthly">
                {/* Monthly pricing will be shown by default */}
              </TabsContent>
              <TabsContent value="yearly">
                {/* Yearly pricing would be shown here */}
              </TabsContent>
            </Tabs>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {pricingPlans.map((plan, i) => (
                <motion.div 
                  key={i}
                  className={cn(
                    "bg-white rounded-xl overflow-hidden shadow-lg border", 
                    plan.popular ? "border-primary relative" : "border-gray-100"
                  )}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  {plan.popular && (
                    <div className="bg-primary text-white text-center py-1 text-sm font-medium">
                      Most Popular
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-muted-foreground mb-6">{plan.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-gray-500">/{plan.period}</span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className={cn(
                        "w-full", 
                        plan.popular 
                          ? "bg-primary hover:bg-primary/90 text-white" 
                          : "bg-white border-2 border-primary text-primary hover:bg-primary/5"
                      )}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* FAQs */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4 inline-block">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about SOULo
            </p>
          </div>
          
          <div className="space-y-6">
            {[
              {
                question: "How does voice journaling work?",
                answer: "SOULo makes it easy to capture your thoughts by speaking. Just open the app, tap the record button, and speak freely. Our AI will transcribe your voice and analyze the content for emotional patterns and key themes."
              },
              {
                question: "Is my data private and secure?",
                answer: "Absolutely. Your privacy is our top priority. All your journal entries are end-to-end encrypted, and you have complete control over what you share. We do not sell or share your data with third parties."
              },
              {
                question: "Can I use SOULo without internet connection?",
                answer: "Yes, you can record your journal entries offline. They will be stored locally on your device and will sync with our servers when you reconnect to the internet."
              },
              {
                question: "What languages does SOULo support?",
                answer: "Currently, SOULo supports English, Spanish, French, German, and Japanese. We're continuously working to add more languages."
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
      
      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 to-purple-100">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Start Your Self-Discovery Journey?</h2>
          <p className="text-xl text-gray-700 mb-8">
            Join thousands of people who have transformed their self-reflection practice with SOULo.
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
            <Button 
              size="lg" 
              variant="outline" 
              asChild
            >
              <a href="/app">Try Web App</a>
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
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;
