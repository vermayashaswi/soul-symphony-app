
import React from 'react';
import { useNonBlockingRevenueCat } from '@/hooks/useNonBlockingRevenueCat';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Crown, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SubscriptionManagerProps {
  className?: string;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ className = '' }) => {
  const {
    isInitialized,
    purchaserInfo,
    products,
    isInitializing,
    isPremium,
    isTrialActive,
    trialEndDate,
    
    purchaseProduct,
    restorePurchases,
    checkTrialEligibility
  } = useNonBlockingRevenueCat();

  const [isEligibleForTrial, setIsEligibleForTrial] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const checkEligibility = async () => {
      if (products.length > 0) {
        const eligible = await checkTrialEligibility(products[0].identifier);
        setIsEligibleForTrial(eligible);
      }
    };
    
    if (isInitialized) {
      checkEligibility();
    }
  }, [isInitialized, products, checkTrialEligibility]);

  const handleStartTrial = async () => {
    if (products.length > 0) {
      await purchaseProduct(products[0].identifier);
    }
  };

  if (!isInitialized || isInitializing) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isPremium && isTrialActive) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Premium Trial Active
          </CardTitle>
          <CardDescription>
            You're currently enjoying premium features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
               <span className="text-sm">
                 {trialEndDate ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0} days remaining in your trial
               </span>
            </div>
            
            {trialEndDate && (
              <div className="text-sm text-muted-foreground">
                Trial ends on {trialEndDate.toLocaleDateString()}
              </div>
            )}
            
            <Badge variant="secondary" className="w-fit">
              Premium Features Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPremium && !isTrialActive) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Premium Subscription
          </CardTitle>
          <CardDescription>
            You have an active premium subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="default" className="w-fit">
            Premium Active
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Start Your Premium Trial</CardTitle>
        <CardDescription>
          Unlock advanced journaling features with a 7-day free trial
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.length > 0 && (
            <div className="space-y-3">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium">{products[0].title}</h4>
                <p className="text-sm text-muted-foreground">{products[0].description}</p>
                <div className="mt-2">
                  <span className="text-lg font-semibold">7 days free</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    then {products[0].priceString}/month
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                {isEligibleForTrial && (
                   <Button 
                     onClick={handleStartTrial}
                     disabled={isInitializing}
                     className="flex-1"
                   >
                    Start Free Trial
                  </Button>
                )}
                
                 <Button 
                   variant="outline" 
                   onClick={restorePurchases}
                   disabled={isInitializing}
                   className="flex items-center gap-2"
                 >
                  <RefreshCw className="h-4 w-4" />
                  Restore
                </Button>
              </div>
              
              {!isEligibleForTrial && isEligibleForTrial !== null && (
                <div className="text-sm text-muted-foreground text-center">
                  You've already used your free trial for this product.
                </div>
              )}
            </div>
          )}
          
          {products.length === 0 && (
            <div className="text-center text-muted-foreground">
              No subscription products available at the moment.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionManager;
