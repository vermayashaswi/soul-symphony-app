
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProfileSetupStepProps {
  onContinue: () => void;
}

const ProfileSetupStep: React.FC<ProfileSetupStepProps> = ({ onContinue }) => {
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Store in localStorage first for quick access
      localStorage.setItem('user_display_name', displayName);
      
      // If user is logged in, update their profile as well
      if (user) {
        await updateUserProfile({ display_name: displayName });
      }
      
      onContinue();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "There was a problem saving your profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full px-6 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.form 
        className="w-full max-w-md space-y-6" 
        onSubmit={handleSubmit}
        variants={containerVariants}
      >
        <motion.div variants={itemVariants}>
          <Label htmlFor="displayName" className="block text-sm font-medium mb-2">
            What should we call you?
          </Label>
          <Input
            id="displayName"
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full"
            autoFocus
          />
        </motion.div>
        
        <motion.div variants={itemVariants} className="mt-8">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Button>
        </motion.div>
      </motion.form>
    </motion.div>
  );
};

export default ProfileSetupStep;
