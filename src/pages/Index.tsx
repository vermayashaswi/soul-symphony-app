
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import ParticleBackground from '@/components/ParticleBackground';
import { useAuth } from '@/contexts/AuthContext';
import BackendTester from '@/components/BackendTester';

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/journal');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <ParticleBackground />
      <Navbar />
      
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-6 relative z-10">
        <div className="max-w-3xl w-full text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 mb-4">
            Welcome to Feelosophy
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8">
            Explore your thoughts, track your emotions, and gain valuable insights with AI-powered journaling
          </p>
          <Button size="lg" onClick={handleGetStarted} className="text-lg px-8 py-6">
            {user ? 'Go to Journal' : 'Get Started'}
          </Button>
        </div>
        
        {user && (
          <div className="w-full max-w-3xl mt-8">
            <BackendTester />
          </div>
        )}
      </div>
    </div>
  );
}
