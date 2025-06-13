
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// RevenueCat configuration constants
const REVENUECAT_CONFIG = {
  ENTITLEMENTS: {
    PREMIUM_ACCESS: 'entl9730aa8da2'
  },
  PRODUCTS: {
    PREMIUM_MONTHLY_US: 'premium_monthly_us',
    PREMIUM_MONTHLY_IN: 'premium_monthly_in',
    PREMIUM_MONTHLY_GB: 'premium_monthly_gb',
    PREMIUM_MONTHLY_DEFAULT: 'premium_monthly_default'
  }
};

interface RevenueCatWebhookEvent {
  event: {
    type: string;
    app_user_id: string;
    original_app_user_id: string;
    product_id: string;
    period_type: 'TRIAL' | 'INTRO' | 'NORMAL';
    purchased_at_ms: number;
    expiration_at_ms: number;
    environment: 'SANDBOX' | 'PRODUCTION';
    entitlement_id?: string;
    entitlement_ids?: string[];
    transaction_id: string;
    original_transaction_id: string;
    is_family_share: boolean;
    country_code: string;
    app_id: string;
    offering_id?: string;
    store: 'APP_STORE' | 'MAC_APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    currency: string;
    price: number;
    price_in_purchased_currency: number;
    subscriber_attributes?: Record<string, any>;
    takehome_percentage?: number;
    renewal_number?: number;
    cancel_reason?: string;
    grace_period_expiration_at_ms?: number;
    auto_renew_status?: boolean;
  };
  api_version: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const webhookData: RevenueCatWebhookEvent = await req.json();
    
    console.log('Received RevenueCat webhook:', JSON.stringify(webhookData, null, 2));

    // Validate the webhook is for our premium access entitlement
    const event = webhookData.event;
    const isPremiumEntitlement = event.entitlement_ids?.includes(REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS) ||
                                event.entitlement_id === REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS;

    if (!isPremiumEntitlement) {
      console.log('Webhook event not for premium entitlement, ignoring');
      return new Response(
        JSON.stringify({ success: true, message: 'Event not for premium entitlement' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the webhook event
    const { error: logError } = await supabase
      .from('revenuecat_webhook_events')
      .insert({
        event_type: event.type,
        revenuecat_user_id: event.original_app_user_id,
        app_user_id: event.app_user_id,
        product_id: event.product_id,
        event_timestamp: new Date(event.purchased_at_ms).toISOString(),
        raw_payload: webhookData,
        processed: false
      });

    if (logError) {
      console.error('Error logging webhook event:', logError);
    }

    // Find the customer
    const { data: customer, error: customerError } = await supabase
      .from('revenuecat_customers')
      .select('*')
      .eq('revenuecat_user_id', event.original_app_user_id)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found for webhook event:', customerError);
      
      // Try to create customer if not found
      if (customerError?.code === 'PGRST116') {
        const { error: createError } = await supabase
          .from('revenuecat_customers')
          .insert({
            user_id: event.app_user_id,
            revenuecat_user_id: event.original_app_user_id,
            revenuecat_app_user_id: event.app_user_id
          });

        if (createError) {
          console.error('Failed to create customer:', createError);
          return new Response(
            JSON.stringify({ error: 'Failed to create customer' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Retry fetching the customer
        const { data: newCustomer, error: retryError } = await supabase
          .from('revenuecat_customers')
          .select('*')
          .eq('revenuecat_user_id', event.original_app_user_id)
          .single();

        if (retryError || !newCustomer) {
          console.error('Still cannot find customer after creation:', retryError);
          return new Response(
            JSON.stringify({ error: 'Customer creation failed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Successfully created customer for webhook');
      } else {
        return new Response(
          JSON.stringify({ error: 'Customer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Process different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
        await handleSubscriptionEvent(supabase, customer, webhookData, 'active');
        break;
        
      case 'CANCELLATION':
        await handleSubscriptionEvent(supabase, customer, webhookData, 'cancelled');
        break;
        
      case 'EXPIRATION':
        await handleSubscriptionEvent(supabase, customer, webhookData, 'expired');
        break;
        
      case 'BILLING_ISSUE':
        await handleSubscriptionEvent(supabase, customer, webhookData, 'billing_retry_period');
        break;
        
      case 'NON_RENEWING_PURCHASE':
        await handleSubscriptionEvent(supabase, customer, webhookData, 'in_trial');
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
    }

    // Mark webhook as processed
    await supabase
      .from('revenuecat_webhook_events')
      .update({ 
        processed: true, 
        processed_at: new Date().toISOString() 
      })
      .eq('revenuecat_user_id', event.original_app_user_id)
      .eq('event_type', event.type)
      .eq('processed', false);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSubscriptionEvent(
  supabase: any,
  customer: any,
  webhookData: RevenueCatWebhookEvent,
  status: string
) {
  const event = webhookData.event;
  
  // Determine subscription tier and status based on entitlement
  const isPremiumEvent = event.entitlement_ids?.includes(REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS) ||
                        event.entitlement_id === REVENUECAT_CONFIG.ENTITLEMENTS.PREMIUM_ACCESS;
  
  const subscriptionTier = isPremiumEvent ? 'premium' : 'free';
  const subscriptionStatus = status === 'active' || status === 'in_trial' ? status : 'expired';
  
  // Check if subscription already exists
  const { data: existingSub } = await supabase
    .from('revenuecat_subscriptions')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('product_id', event.product_id)
    .single();

  const subscriptionData = {
    customer_id: customer.id,
    revenuecat_subscription_id: event.transaction_id,
    product_id: event.product_id,
    offering_id: event.offering_id || null,
    status: status,
    period_type: event.period_type?.toLowerCase() || 'normal',
    purchase_date: new Date(event.purchased_at_ms).toISOString(),
    original_purchase_date: new Date(event.purchased_at_ms).toISOString(),
    expires_date: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    is_sandbox: event.environment === 'SANDBOX',
    auto_renew_status: event.auto_renew_status ?? true,
    price_in_purchased_currency: event.price_in_purchased_currency || 0,
    currency: event.currency || 'USD',
    updated_at: new Date().toISOString()
  };

  if (status === 'cancelled') {
    subscriptionData.unsubscribe_detected_at = new Date().toISOString();
  }

  if (status === 'billing_retry_period') {
    subscriptionData.billing_issues_detected_at = new Date().toISOString();
  }

  if (existingSub) {
    // Update existing subscription
    const { error } = await supabase
      .from('revenuecat_subscriptions')
      .update(subscriptionData)
      .eq('id', existingSub.id);

    if (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  } else {
    // Create new subscription
    const { error } = await supabase
      .from('revenuecat_subscriptions')
      .insert(subscriptionData);

    if (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  // Update user profile with subscription information
  const profileUpdate: any = {
    subscription_tier: subscriptionTier,
    subscription_status: subscriptionStatus,
    is_premium: subscriptionTier === 'premium' && (status === 'active' || status === 'in_trial'),
    updated_at: new Date().toISOString()
  };

  // Set trial end date for trial subscriptions
  if (event.period_type === 'TRIAL' && event.expiration_at_ms) {
    profileUpdate.trial_ends_at = new Date(event.expiration_at_ms).toISOString();
  }

  // Clear trial end date for non-trial subscriptions
  if (event.period_type !== 'TRIAL') {
    profileUpdate.trial_ends_at = null;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', customer.user_id);

  if (profileError) {
    console.error('Error updating user profile:', profileError);
    // Don't throw here as the subscription was processed successfully
  }

  console.log(`Successfully processed ${event.type} event for customer ${customer.id}`);
}
