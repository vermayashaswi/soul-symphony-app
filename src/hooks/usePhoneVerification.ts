
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface PhoneVerificationState {
  isLoading: boolean;
  codeSent: boolean;
  isVerifying: boolean;
  phoneNumber: string;
  expiresAt: Date | null;
  countryCode: string;
  attempts: number;
  maxAttempts: number;
}

export const usePhoneVerification = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PhoneVerificationState>({
    isLoading: false,
    codeSent: false,
    isVerifying: false,
    phoneNumber: '',
    expiresAt: null,
    countryCode: '1',
    attempts: 0,
    maxAttempts: 3
  });

  const sendVerificationCode = async (phoneNumber: string, countryCode?: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('Sending verification code to:', phoneNumber);
      
      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: {
          phoneNumber,
          userId: user?.id,
          countryCode
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        // Handle rate limiting specially
        if (data.isRateLimited) {
          setState(prev => ({ ...prev, isLoading: false }));
          const retryMinutes = Math.ceil((data.retryAfter || 3600) / 60);
          toast.error(`Rate limited. Please try again in ${retryMinutes} minutes.`);
          return { success: false, error: data.error, isRateLimited: true };
        }
        throw new Error(data.error);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        codeSent: true,
        phoneNumber: data.phoneNumber || phoneNumber,
        countryCode: countryCode || prev.countryCode,
        expiresAt: new Date(Date.now() + (data.expiresIn * 1000)),
        attempts: 0
      }));

      toast.success('Verification code sent to your phone');
      return { success: true };

    } catch (error: any) {
      console.error('Error sending verification code:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      
      let errorMessage = 'Failed to send verification code';
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const verifyCode = async (code: string) => {
    setState(prev => ({ 
      ...prev, 
      isVerifying: true,
      attempts: prev.attempts + 1
    }));

    try {
      console.log('Verifying code:', code);
      
      const { data, error } = await supabase.functions.invoke('verify-sms-code', {
        body: {
          phoneNumber: state.phoneNumber,
          code,
          userId: user?.id
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setState(prev => ({
        ...prev,
        isVerifying: false,
        codeSent: false,
        phoneNumber: '',
        expiresAt: null,
        attempts: 0
      }));

      toast.success('Phone number verified successfully!');
      return { success: true };

    } catch (error: any) {
      console.error('Error verifying code:', error);
      
      const newAttempts = state.attempts + 1;
      const shouldReset = newAttempts >= state.maxAttempts;
      
      setState(prev => ({ 
        ...prev, 
        isVerifying: false,
        codeSent: shouldReset ? false : prev.codeSent,
        attempts: shouldReset ? 0 : newAttempts
      }));
      
      let errorMessage = 'Failed to verify code';
      if (error.message) {
        if (error.message.includes('expired')) {
          errorMessage = 'Verification code has expired. Please request a new one.';
        } else if (error.message.includes('invalid')) {
          errorMessage = `Invalid verification code. ${state.maxAttempts - newAttempts} attempts remaining.`;
        } else {
          errorMessage = error.message;
        }
      }
      
      if (shouldReset) {
        errorMessage += ' Maximum attempts reached. Please request a new code.';
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage, attemptsRemaining: state.maxAttempts - newAttempts };
    }
  };

  const resetState = () => {
    setState({
      isLoading: false,
      codeSent: false,
      isVerifying: false,
      phoneNumber: '',
      expiresAt: null,
      countryCode: '1',
      attempts: 0,
      maxAttempts: 3
    });
  };

  return {
    ...state,
    sendVerificationCode,
    verifyCode,
    resetState
  };
};
