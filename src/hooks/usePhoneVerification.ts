
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
}

export const usePhoneVerification = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PhoneVerificationState>({
    isLoading: false,
    codeSent: false,
    isVerifying: false,
    phoneNumber: '',
    expiresAt: null
  });

  const sendVerificationCode = async (phoneNumber: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-verification', {
        body: {
          phoneNumber,
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
        isLoading: false,
        codeSent: true,
        phoneNumber,
        expiresAt: new Date(Date.now() + (data.expiresIn * 1000))
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
    setState(prev => ({ ...prev, isVerifying: true }));

    try {
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
        expiresAt: null
      }));

      toast.success('Phone number verified successfully!');
      return { success: true };

    } catch (error: any) {
      console.error('Error verifying code:', error);
      setState(prev => ({ ...prev, isVerifying: false }));
      
      let errorMessage = 'Failed to verify code';
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const resetState = () => {
    setState({
      isLoading: false,
      codeSent: false,
      isVerifying: false,
      phoneNumber: '',
      expiresAt: null
    });
  };

  return {
    ...state,
    sendVerificationCode,
    verifyCode,
    resetState
  };
};
