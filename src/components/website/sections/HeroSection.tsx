
import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Brain, TrendingUp, Shield } from 'lucide-react';
import SouloLogo from '@/components/SouloLogo';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-16">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-6xl mx-auto text-center">
        {/* Logo and Tagline */}
        <div className="flex flex-col items-center mb-8">
          <SouloLogo size="large" useColorTheme={true} />
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
            Your Voice, Your Journey
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl">
            Express your thoughts through voice, reflect on your emotions with AI insights, and grow through personalized guidance.
          </p>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Button size="lg" className="text-lg px-8 py-4" asChild>
            <a href="https://apps.apple.com/app/soulo" target="_blank" rel="noopener noreferrer">
              Download on App Store
            </a>
          </Button>
          <Button variant="outline" size="lg" className="text-lg px-8 py-4" asChild>
            <a href="https://play.google.com/store/apps/details?id=com.soulo" target="_blank" rel="noopener noreferrer">
              Get it on Google Play
            </a>
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Mic className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Voice Journaling</h3>
            <p className="text-gray-600 text-sm">
              Capture your thoughts naturally through voice recording in multiple languages.
            </p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI Insights</h3>
            <p className="text-gray-600 text-sm">
              Get personalized emotional insights and patterns from your journal entries.
            </p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Growth Tracking</h3>
            <p className="text-gray-600 text-sm">
              Monitor your emotional journey and personal development over time.
            </p>
          </div>

          <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 hover:shadow-lg transition-all duration-300">
            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-pink-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Privacy First</h3>
            <p className="text-gray-600 text-sm">
              Your thoughts are encrypted and secure. Only you have access to your journal.
            </p>
          </div>
        </div>

        {/* Additional CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            Start your journey of self-discovery today
          </p>
          <Button variant="outline" size="lg" asChild>
            <a href="#features">
              Learn More
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
