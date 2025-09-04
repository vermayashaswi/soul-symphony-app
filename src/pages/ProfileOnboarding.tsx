import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Animated script that appears sentence by sentence
const scriptLines = [
  "Hey, Welcome to SouLo!",
  "Let's get to know you a little better.",
  "All this will help me provide you contextual guidance and give you the best insights possible.",
  "I want to know your age, where you live, your gender, what you do for a living.",
  "Tell me about your interests, hobbies, and a little bit about what you like and dislike.",
  "The more you tell me, the more I know 'YOU' and the more 'you' helps 'you'!"
];

const ProfileOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [showMicButton, setShowMicButton] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Voice recorder setup
  const {
    status,
    startRecording,
    stopRecording,
    recordingTime,
    elapsedTimeMs
  } = useVoiceRecorder({
    onRecordingComplete: handleRecordingComplete,
    onError: (error) => {
      console.error('Recording error:', error);
      toast({
        title: "Recording Error",
        description: "Something went wrong with the recording. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Script animation effect
  useEffect(() => {
    if (currentLineIndex < scriptLines.length) {
      const timer = setTimeout(() => {
        setCurrentLineIndex(prev => prev + 1);
      }, 2500); // Each line appears after 2.5 seconds
      return () => clearTimeout(timer);
    } else {
      // All lines shown, show mic button after a short delay
      const timer = setTimeout(() => {
        setShowMicButton(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentLineIndex]);

  async function handleRecordingComplete(audioBlob: Blob) {
    try {
      setIsProcessing(true);
      console.log('[ProfileOnboarding] Processing audio recording...');
      
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
      
      // Send audio to processing function
      const { error } = await supabase.functions.invoke('process-profile-audio', {
        body: {
          audio_data: base64Audio,
          user_id: user?.id
        }
      });

      if (error) {
        console.error('[ProfileOnboarding] Error processing audio:', error);
        toast({
          title: "Processing Error",
          description: "We couldn't process your recording. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Mark profile onboarding as completed
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_onboarding_completed: true })
        .eq('id', user?.id);

      if (updateError) {
        console.error('[ProfileOnboarding] Error updating profile:', updateError);
      }

      toast({
        title: "Thank You!",
        description: "We're processing your information in the background. Welcome to SouLo!",
        variant: "default"
      });

      // Navigate to home page
      navigate('/app/home');
      
    } catch (error) {
      console.error('[ProfileOnboarding] Unexpected error:', error);
      toast({
        title: "Unexpected Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }

  const handleVoiceRecording = () => {
    if (status === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 relative overflow-hidden">
      {/* Animated particles background */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-70"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "linear"
            }}
            style={{
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.8)',
            }}
          />
        ))}
      </div>

      {/* Main content container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        
        {/* Script animation */}
        <div className="max-w-2xl mx-auto mb-12">
          <AnimatePresence mode="wait">
            {scriptLines.slice(0, currentLineIndex + 1).map((line, index) => (
              <motion.p
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8, delay: index === currentLineIndex ? 0 : 0 }}
                className={`text-white font-medium mb-4 ${
                  index === 0 
                    ? 'text-3xl md:text-4xl mb-8' 
                    : 'text-lg md:text-xl'
                }`}
                style={{
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  lineHeight: '1.5'
                }}
              >
                {line}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>

        {/* Mic button and instructions */}
        <AnimatePresence>
          {showMicButton && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center space-y-6"
            >
              {/* Instructions */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-white text-lg md:text-xl max-w-xl mx-auto mb-6"
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
              >
                Tap this button and start speaking in any language. Tell me as much as you can about yourself!
              </motion.p>

              {/* Recording button */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="relative"
              >
                {/* Pulsing ring effect */}
                {status === 'recording' && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-purple-400"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.8, 0, 0.8]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    style={{
                      width: '120px',
                      height: '120px',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                )}

                <Button
                  size="lg"
                  onClick={handleVoiceRecording}
                  disabled={isProcessing}
                  className={`
                    w-24 h-24 rounded-full flex items-center justify-center
                    ${status === 'recording' 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-purple-600 hover:bg-purple-700'
                    }
                    text-white shadow-2xl transition-all duration-300
                    ${status === 'recording' ? 'scale-110' : 'hover:scale-105'}
                  `}
                  style={{
                    boxShadow: status === 'recording' 
                      ? '0 0 30px rgba(239, 68, 68, 0.6)' 
                      : '0 0 30px rgba(147, 51, 234, 0.6)'
                  }}
                >
                  {isProcessing ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </Button>

                {/* Recording time display */}
                {status === 'recording' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
                  >
                    <p className="text-white text-sm font-medium">
                      {recordingTime}
                    </p>
                  </motion.div>
                )}
              </motion.div>

              {/* Status messages */}
              <AnimatePresence>
                {status === 'recording' && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-purple-200 text-sm"
                  >
                    Listening... Tap again to stop
                  </motion.p>
                )}
                {status === 'stopping' && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-purple-200 text-sm"
                  >
                    Processing your recording...
                  </motion.p>
                )}
                {isProcessing && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-purple-200 text-sm"
                  >
                    Analyzing your information...
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ProfileOnboarding;