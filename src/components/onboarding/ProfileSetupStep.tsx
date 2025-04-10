
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
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter your name to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Store in local storage for immediate use
      localStorage.setItem('user_display_name', displayName);
      
      // Update the user profile if authenticated
      if (user) {
        await updateUserProfile({
          full_name: displayName,
          name: displayName
        });
      }
      
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
      
      onContinue();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update your profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Your Name</Label>
          <Input
            id="displayName"
            placeholder="Enter your name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </Button>
      </form>
    </motion.div>
  );
};

export default ProfileSetupStep;
