
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Bell, Shield, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PermissionType } from '@/services/permissionService';
import { TranslatableText } from '@/components/translation/TranslatableText';

interface PermissionPromptProps {
  type: PermissionType;
  isVisible: boolean;
  isLoading?: boolean;
  onAllow: () => Promise<void>;
  onDeny: () => void;
  onClose: () => void;
  isTWAEnvironment?: boolean;
  className?: string;
}

const permissionConfig = {
  microphone: {
    icon: Mic,
    title: 'Microphone Access',
    description: 'Soulo needs microphone access to record your voice journal entries.',
    benefits: [
      'Record voice journal entries',
      'Express thoughts naturally through speech',
      'Get AI-powered insights from your recordings'
    ],
    color: 'blue'
  },
  notifications: {
    icon: Bell,
    title: 'Notification Permission',
    description: 'Stay connected with gentle reminders for journaling and insights.',
    benefits: [
      'Daily journaling reminders',
      'Weekly insight summaries',
      'Never miss your self-care routine'
    ],
    color: 'green'
  }
};

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  type,
  isVisible,
  isLoading = false,
  onAllow,
  onDeny,
  onClose,
  isTWAEnvironment = false,
  className
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const config = permissionConfig[type];
  const Icon = config.icon;

  const handleAllow = async () => {
    try {
      setIsProcessing(true);
      await onAllow();
    } catch (error) {
      console.error('[PermissionPrompt] Error allowing permission:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = () => {
    onDeny();
    onClose();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className={cn("w-full max-w-md", className)}
          >
            <Card className="relative overflow-hidden border-2">
              {/* Header with close button */}
              <div className="absolute top-4 right-4 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  <div className={cn(
                    "p-4 rounded-full",
                    config.color === 'blue' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                  )}>
                    <Icon className="h-8 w-8" />
                  </div>
                </div>

                <CardTitle className="text-xl">
                  <TranslatableText text={config.title} />
                </CardTitle>

                <CardDescription className="text-center">
                  <TranslatableText text={config.description} />
                </CardDescription>

                {isTWAEnvironment && (
                  <Badge variant="secondary" className="mx-auto mt-2">
                    <Shield className="h-3 w-3 mr-1" />
                    <TranslatableText text="Mobile App" />
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Benefits list */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    <TranslatableText text="This allows you to:" />
                  </h4>
                  <div className="space-y-2">
                    {config.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <TranslatableText text={benefit} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3 pt-4">
                  <Button
                    onClick={handleAllow}
                    disabled={isLoading || isProcessing}
                    className={cn(
                      "w-full",
                      config.color === 'blue' ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {isLoading || isProcessing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <TranslatableText text="Processing..." />
                      </div>
                    ) : (
                      <TranslatableText text="Allow Access" />
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleDeny}
                    disabled={isLoading || isProcessing}
                    className="w-full"
                  >
                    <TranslatableText text="Not Now" />
                  </Button>
                </div>

                {/* Additional info for TWA */}
                {isTWAEnvironment && (
                  <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                    <TranslatableText text="You can change this permission anytime in your device settings." />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionPrompt;
