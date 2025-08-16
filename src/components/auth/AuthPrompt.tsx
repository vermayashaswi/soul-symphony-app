
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TranslatableText } from '@/components/translation/TranslatableText';
import SouloLogo from '@/components/SouloLogo';

interface AuthPromptProps {
  title?: string;
  description?: string;
  feature?: string;
  className?: string;
}

export const AuthPrompt: React.FC<AuthPromptProps> = ({
  title = "Sign in required",
  description = "Please sign in to access this feature",
  feature = "this feature",
  className = ""
}) => {
  const navigate = useNavigate();

  return (
    <Card className={`max-w-md mx-auto ${className}`}>
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Lock className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="flex items-center justify-center gap-2">
          <SouloLogo size="small" />
          <TranslatableText text={title} />
        </CardTitle>
        <CardDescription>
          <TranslatableText 
            text={`${description}. Sign in to unlock the full power of ${feature}.`} 
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={() => navigate('/app/auth')} 
          className="w-full" 
          size="lg"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          <TranslatableText text="Sign In to Continue" />
        </Button>
        
        <div className="text-center text-sm text-muted-foreground">
          <TranslatableText text="New to Soulo?" />{' '}
          <button
            onClick={() => navigate('/app/auth')}
            className="text-primary hover:underline font-medium"
          >
            <TranslatableText text="Create your free account" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
};
