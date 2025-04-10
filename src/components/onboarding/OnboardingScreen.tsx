
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useOnboarding } from '@/hooks/use-onboarding';
import ProfileSetupStep from '@/components/onboarding/ProfileSetupStep';
import WelcomeScreen from '@/components/onboarding/WelcomeScreen';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const OnboardingScreen: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { onboardingComplete, completeOnboarding } = useOnboarding();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);
  
  const steps = [
    {
      id: 0,
      title: 'Welcome',
      description: 'Get ready to start your journey to better mental wellbeing',
      icon: UserPlus,
      component: WelcomeScreen,
    },
    {
      id: 1,
      title: 'Profile',
      description: 'Create your profile',
      icon: ShieldCheck,
      component: ProfileSetupStep,
    },
    {
      id: 2,
      title: 'Complete',
      description: 'You\'re all set!',
      icon: CheckCircle,
      component: null,
    },
  ];
  
  useEffect(() => {
    if (onboardingComplete) {
      navigate('/app/home');
    }
  }, [onboardingComplete, navigate]);

  useEffect(() => {
    if (!user) {
      console.log('No user found, redirecting to /auth');
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleContinue = async (index: number) => {
    if (index < steps.length - 1) {
      setStepIndex(index + 1);
    } else {
      try {
        await completeOnboarding();
        toast({
          title: 'Onboarding Complete',
          description: 'You\'re all set to start your journey!',
        });
        navigate('/app/home');
      } catch (error: any) {
        console.error('Error completing onboarding:', error);
        toast({
          title: 'Error',
          description: 'Failed to complete onboarding. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleSignOutConfirmation = () => {
    setShowSignOutConfirmation(true);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast({
        title: 'Signed Out',
        description: 'You have been signed out successfully.',
      });
      navigate('/auth');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSigningOut(false);
      setShowSignOutConfirmation(false);
    }
  };

  const handleCancelSignOut = () => {
    setShowSignOutConfirmation(false);
  };

  const currentStep = steps[stepIndex];
  const StepComponent = currentStep?.component || (() => <></>);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
    exit: { opacity: 0, x: '-100vw', transition: { duration: 0.4 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <motion.div
        key={stepIndex}
        className="glass-card p-8 rounded-xl shadow-lg w-full max-w-md relative overflow-hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            className="flex flex-col items-center justify-center h-full"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div variants={itemVariants} className="text-center mb-6">
              <currentStep.icon className="h-10 w-10 text-primary mx-auto mb-2" />
              <h2 className="text-2xl font-bold">{currentStep.title}</h2>
              <p className="text-muted-foreground">{currentStep.description}</p>
            </motion.div>

            <motion.div variants={itemVariants} className="w-full">
              {currentStep.id === 1 ? (
                <ProfileSetupStep onContinue={() => handleContinue(stepIndex)} />
              ) : currentStep.id === 0 ? (
                <WelcomeScreen onContinue={() => handleContinue(stepIndex)} />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <motion.div variants={itemVariants} className="text-center">
                    <h3 className="text-xl font-semibold mb-2">
                      You're all set!
                    </h3>
                    <p className="text-muted-foreground">
                      Click below to start your journey.
                    </p>
                  </motion.div>
                  <motion.div variants={itemVariants} className="mt-4">
                    <Button onClick={() => handleContinue(stepIndex)}>
                      Go to Dashboard
                    </Button>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-4"
      >
        <Button variant="link" onClick={handleSignOutConfirmation} disabled={isSigningOut}>
          {isSigningOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
      </motion.div>

      <AlertDialog open={showSignOutConfirmation} onOpenChange={setShowSignOutConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSignOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} disabled={isSigningOut}>
              {isSigningOut ? 'Signing Out...' : 'Sign Out'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OnboardingScreen;
