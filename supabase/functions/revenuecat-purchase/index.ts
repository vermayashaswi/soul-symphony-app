import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthenticatedContext } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurchaseRequest {
  productId: string;
  platform: 'android' | 'ios';
  transactionId?: string;
  isTrialPurchase?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('RevenueCat purchase request received');
    
    // Get authenticated context - this ensures JWT token validation and RLS compliance
    const { supabase, userContext } = await getAuthenticatedContext(req);
    const userId = userContext.userId; // Use authenticated user ID

    const { productId, platform, transactionId, isTrialPurchase }: PurchaseRequest = await req.json();
    
    if (!productId) {
      throw new Error('Product ID is required');
    }

    console.log(`Processing purchase for user: ${userId}, product: ${productId}, trial: ${isTrialPurchase}`);

    // Get customer
    const { data: customer, error: customerError } = await supabase
      .from('revenuecat_customers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      throw new Error('Customer not found');
    }

    // Check if user already has an active subscription
    const { data: existingSubscription, error: subError } = await supabase
      .from('revenuecat_subscriptions')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error checking existing subscription:', subError);
      throw subError;
    }

    if (existingSubscription) {
      console.log('User already has active subscription');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User already has an active subscription'
        }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Create subscription record
    const currentTime = new Date().toISOString();
    const trialEndTime = isTrialPurchase 
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
      : null;
    const expiresDate = isTrialPurchase 
      ? trialEndTime
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

    const { data: subscription, error: insertError } = await supabase
      .from('revenuecat_subscriptions')
      .insert({
        customer_id: customer.id,
        product_id: productId,
        status: 'active',
        current_period_start: currentTime,
        current_period_end: expiresDate,
        trial_end: trialEndTime,
        platform: platform,
        transaction_id: transactionId || `sim_${Date.now()}`,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating subscription:', insertError);
      throw insertError;
    }

    // Update user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        subscription_status: isTrialPurchase ? 'trial' : 'active',
        subscription_tier: 'premium',
        is_premium: true,
        trial_ends_at: trialEndTime,
        updated_at: currentTime
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't throw here, subscription was created successfully
    }

    console.log('Purchase processed successfully');
    
    const response = {
      success: true,
      subscription: {
        id: subscription.id,
        productId: subscription.product_id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        trialEnd: subscription.trial_end,
        isTrialActive: !!subscription.trial_end && new Date(subscription.trial_end) > new Date()
      },
      purchaserInfo: {
        customerId: customer.revenuecat_customer_id,
        activeSubscriptions: [productId],
        entitlements: {
          premium: {
            isActive: true,
            willRenew: true,
            periodType: 'normal',
            latestPurchaseDate: currentTime,
            expirationDate: expiresDate,
            store: platform === 'ios' ? 'app_store' : 'play_store',
            productIdentifier: productId
          }
        }
      }
    };

    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('RevenueCat purchase error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});