
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { usePhoneVerification } from '@/hooks/usePhoneVerification';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { EnhancedPhoneInput } from './EnhancedPhoneInput';
import { Phone, MessageSquare, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface PhoneVerificationProps {
  onVerificationComplete?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export const PhoneVerification: React.FC<PhoneVerificationProps> = ({
  onVerificationComplete,
  onBack,
  showBackButton = false
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('1');
  const [verificationCode, setVerificationCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPhoneValid, setIsPhoneValid] = useState(false);

  const {
    isLoading,
    codeSent,
    isVerifying,
    expiresAt,
    attempts,
    maxAttempts,
    sendVerificationCode,
    verifyCode,
    resetState
  } = usePhoneVerification();

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const difference = expiry - now;

      if (difference > 0) {
        setTimeLeft(Math.floor(difference / 1000));
      } else {
        setTimeLeft(0);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handlePhoneChange = (value: string, country: string) => {
    setPhoneNumber(value);
    setCountryCode(country);
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim() || !isPhoneValid) {
      return;
    }

    const result = await sendVerificationCode(phoneNumber, countryCode);
    if (!result.success && result.isRateLimited) {
      // Handle rate limiting UI feedback if needed
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      return;
    }

    const result = await verifyCode(verificationCode);
    if (result.success) {
      onVerificationComplete?.();
    } else {
      // Clear the code input on failed verification
      setVerificationCode('');
    }
  };

  const handleResendCode = async () => {
    setVerificationCode('');
    await sendVerificationCode(phoneNumber, countryCode);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!codeSent) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Phone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>
            <TranslatableText text="Verify Phone Number" />
          </CardTitle>
          <CardDescription>
            <TranslatableText text="Enter your phone number to receive a verification code" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showBackButton && (
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <TranslatableText text="Back" />
            </Button>
          )}
          
          <EnhancedPhoneInput
            value={phoneNumber}
            onChange={handlePhoneChange}
            onValidityChange={setIsPhoneValid}
            placeholder="Enter your phone number"
          />

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <TranslatableText text="Standard SMS rates may apply. We'll only use your number for verification." />
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleSendCode}
            disabled={isLoading || !phoneNumber.trim() || !isPhoneValid}
            className="w-full"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                <TranslatableText text="Sending..." />
              </div>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                <TranslatableText text="Send Verification Code" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>
          <TranslatableText text="Enter Verification Code" />
        </CardTitle>
        <CardDescription>
          <TranslatableText text={`We sent a 6-digit code to ${phoneNumber}`} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="text-center">
            <InputOTP 
              value={verificationCode} 
              onChange={setVerificationCode}
              maxLength={6}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {attempts > 0 && attempts < maxAttempts && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  <TranslatableText text="Verification attempts" />
                </span>
                <span className="text-muted-foreground">
                  {attempts}/{maxAttempts}
                </span>
              </div>
              <Progress value={(attempts / maxAttempts) * 100} className="h-1" />
            </div>
          )}

          {timeLeft > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                <TranslatableText text={`Code expires in ${formatTime(timeLeft)}`} />
              </p>
              <Progress 
                value={(timeLeft / 600) * 100} 
                className="h-1 mt-2" 
              />
            </div>
          )}
        </div>

        <Button
          onClick={handleVerifyCode}
          disabled={isVerifying || verificationCode.length !== 6}
          className="w-full"
        >
          {isVerifying ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              <TranslatableText text="Verifying..." />
            </div>
          ) : (
            <TranslatableText text="Verify Phone Number" />
          )}
        </Button>

        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={handleResendCode}
            disabled={isLoading || timeLeft > 0}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <TranslatableText text={timeLeft > 0 ? `Resend in ${formatTime(timeLeft)}` : "Resend Code"} />
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              resetState();
              setPhoneNumber('');
              setVerificationCode('');
            }}
            className="w-full"
          >
            <TranslatableText text="Use Different Phone Number" />
          </Button>
        </div>

        {attempts >= maxAttempts && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <TranslatableText text="Maximum verification attempts reached. Please request a new code." />
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
