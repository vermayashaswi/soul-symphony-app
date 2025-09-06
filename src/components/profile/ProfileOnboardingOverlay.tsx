import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useTypewriter } from '@/hooks/use-typewriter';
import { PulsatingRecordButton } from './PulsatingRecordButton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ProfileOnboardingOverlayProps {
  onClose: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  showThankYou?: boolean;
  source?: 'smartchat' | 'settings';
}

export const ProfileOnboardingOverlay: React.FC<ProfileOnboardingOverlayProps> = ({
  onClose,
  onComplete,
  onSkip,
  showThankYou: initialShowThankYou = false,
  source = 'smartchat'
}) => {
  const [showMicButton, setShowMicButton] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [showThankYou, setShowThankYou] = useState(initialShowThankYou);
  const [audioLevel, setAudioLevel] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const scriptSections = [
    { text: "Hey, Welcome to SouLo!\n\n", speed: 80, pauseAfter: 800 },
    { text: "No endless forms. Just use your voice and tell me about you.\n\n", speed: 60, pauseAfter: 1000 },
    { text: "All this will help me provide you contextual guidance.\n\n", speed: 50, pauseAfter: 800 },
    { text: "I want to know your age, where you live, your gender, what you do for a living.\n\n", speed: 45, pauseAfter: 600 },
    { text: "Tell me about your interests, hobbies, and a little bit about what you like and dislike.\n\n", speed: 45, pauseAfter: 800 },
    { text: "The more you tell me, the more I know YOU and the more you helps you!", speed: 40, pauseAfter: 500 }
  ];

  const { displayText, isComplete, startTyping } = useTypewriter(scriptSections, {
    onComplete: () => {
      const timer = setTimeout(() => {
        setShowMicButton(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  });

  // Start typewriter animation
  useEffect(() => {
    if (showThankYou) return;
    
    const timer = setTimeout(() => {
      startTyping();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [showThankYou, startTyping]);

  const {
    status,
    startRecording,
    stopRecording,
    recordingTime,
    elapsedTimeMs
  } = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    onError: (error) => {
      console.error('Voice recording error:', error);
      setIsProcessing(false);
      toast({
        title: "Recording Error",
        description: "Failed to record audio. Please try again.",
        variant: "destructive"
      });
    },
    maxDuration: 300
  });

  async function handleRecordingComplete(audioBlob: Blob) {
    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to continue",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      console.log('[ProfileOnboardingOverlay] Processing audio blob:', audioBlob.size);

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const base64Audio = base64.split(',')[1];

          console.log('[ProfileOnboardingOverlay] Calling process-profile-audio function');
          
          // Fix: Use correct parameter names matching the edge function
          const { data, error } = await supabase.functions.invoke('process-profile-audio', {
            body: { 
              audio_data: base64Audio,  // Changed from 'audio' to 'audio_data'
              user_id: user.id 
            }
          });

          if (error) {
            console.error('[ProfileOnboardingOverlay] Edge function error:', error);
            throw error;
          }

          console.log('[ProfileOnboardingOverlay] Profile audio processed successfully:', data);

          // Update the profile completion status and first visit flag
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              profile_onboarding_completed: true,
              first_smart_chat_visit: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) {
            console.error('[ProfileOnboardingOverlay] Error updating profile:', updateError);
            throw updateError;
          }

          // Show thank you message
          setShowThankYou(true);
          
        } catch (error) {
          console.error('[ProfileOnboardingOverlay] Error processing audio:', error);
          toast({
            title: "Processing Error",
            description: "Failed to process your recording. Please try again.",
            variant: "destructive"
          });
        } finally {
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        console.error('[ProfileOnboardingOverlay] Error reading audio blob');
        setIsProcessing(false);
        toast({
          title: "Error",
          description: "Failed to read audio recording",
          variant: "destructive"
        });
      };

    } catch (error) {
      console.error('[ProfileOnboardingOverlay] Error in handleRecordingComplete:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  }

  const handleVoiceRecording = async () => {
    if (status === 'recording') {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleSkip = async () => {
    if (!user?.id || isSkipping) return;
    
    try {
      setIsSkipping(true);
      console.log('[ProfileOnboardingOverlay] Skipping onboarding for user:', user.id);
      
      // Update first visit flag and onboarding completed when user skips
      const { error } = await supabase
        .from('profiles')
        .update({ 
          first_smart_chat_visit: false,
          profile_onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('[ProfileOnboardingOverlay] Error updating profile during skip:', error);
        toast({
          title: "Skip Error",
          description: "Failed to skip onboarding. Please try again.",
          variant: "destructive"
        });
        return;
      }

      console.log('[ProfileOnboardingOverlay] Successfully skipped onboarding');
      toast({
        title: "Onboarding Skipped",
        description: "You can complete your profile later in settings.",
        variant: "default"
      });

      // Navigate based on source context
      if (source === 'smartchat') {
        // Just close overlay, user stays on chat
        onSkip?.();
        onClose();
      } else {
        // Close overlay, user stays on settings
        onSkip?.();
        onClose();
      }
    } catch (error) {
      console.error('[ProfileOnboardingOverlay] Error in handleSkip:', error);
      toast({
        title: "Error",
        description: "An error occurred while skipping. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSkipping(false);
    }
  };

  const handleStartJournaling = () => {
    navigate('/app/journal');
    onComplete?.();
    onClose();
  };

  if (showThankYou) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-purple-800 to-indigo-900"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              transition={{
                duration: Math.random() * 10 + 5,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-md mx-auto px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <img 
              src="/lovable-uploads/soulo-icon.png?v=3" 
              alt="Soulo Icon" 
              className="w-24 h-24 mx-auto mb-6"
            />
            
            <h2 className="text-3xl font-bold text-white mb-4">
              Thank you!
            </h2>
            
            <p className="text-white/80 text-lg mb-8">
              Your profile has been created successfully. Ready to start your journaling journey?
            </p>
            
            <Button
              onClick={handleStartJournaling}
              className="bg-white text-purple-800 hover:bg-white/90 font-semibold py-3 px-8 text-lg"
            >
              Start Journaling
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-purple-800 to-indigo-900"
    >
      {/* Skip button */}
      <Button
        onClick={handleSkip}
        variant="ghost"
        size="sm"
        disabled={isSkipping}
        className="absolute top-4 right-4 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
      >
        <X className="h-4 w-4 mr-2" />
        {isSkipping ? 'Skipping...' : 'Skip'}
      </Button>

      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              repeatType: "reverse",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        {/* Soulo icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <img 
            src="/lovable-uploads/soulo-icon.png?v=3" 
            alt="Soulo Icon" 
            className="w-24 h-24 mx-auto"
          />
        </motion.div>

        {/* Typewriter text */}
        <div className="mb-6 min-h-[100px] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white text-sm font-medium leading-relaxed text-center whitespace-pre-line max-w-md"
          >
            {displayText}
            {!isComplete && <span className="animate-pulse ml-1">|</span>}
          </motion.div>
        </div>

        {/* Microphone button */}
        <AnimatePresence>
          {showMicButton && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              <PulsatingRecordButton
                isRecording={status === 'recording'}
                isLoading={isProcessing}
                recordingTime="" // Remove time display as requested
                audioLevel={audioLevel}
                onToggleRecording={handleVoiceRecording}
                disabled={isProcessing}
              />
              
              {isProcessing && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/80 text-sm mt-4"
                >
                  Processing your recording...
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};