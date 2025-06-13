
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { usePhoneVerification } from '@/hooks/usePhoneVerification';
import { TranslatableText } from '@/components/translation/TranslatableText';
import { Phone, MessageSquare, ArrowLeft } from 'lucide-react';

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
  const [verificationCode, setVerificationCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  const {
    isLoading,
    codeSent,
    isVerifying,
    expiresAt,
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

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      return;
    }

    // Add + if not present and format phone number
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    const result = await sendVerificationCode(formattedPhone);
    if (result.success) {
      setPhoneNumber(formattedPhone);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      return;
    }

    const result = await verifyCode(verificationCode);
    if (result.success) {
      onVerificationComplete?.();
    }
  };

  const handleResendCode = async () => {
    setVerificationCode('');
    await sendVerificationCode(phoneNumber);
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
        <CardContent className="space-y-4">
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
          
          <div className="space-y-2">
            <Label htmlFor="phone">
              <TranslatableText text="Phone Number" />
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="text-center"
            />
            <p className="text-sm text-muted-foreground text-center">
              <TranslatableText text="Use international format (e.g., +1234567890)" />
            </p>
          </div>

          <Button
            onClick={handleSendCode}
            disabled={isLoading || !phoneNumber.trim()}
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
          <TranslatableText text={`We sent a code to ${phoneNumber}`} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code" className="text-center block">
            <TranslatableText text="6-Digit Code" />
          </Label>
          <div className="flex justify-center">
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
        </div>

        {timeLeft > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            <TranslatableText text={`Code expires in ${formatTime(timeLeft)}`} />
          </div>
        )}

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

        <div className="flex flex-col space-y-2">
          <Button
            variant="ghost"
            onClick={handleResendCode}
            disabled={isLoading || timeLeft > 0}
            className="w-full"
          >
            <TranslatableText text="Resend Code" />
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
      </CardContent>
    </Card>
  );
};
