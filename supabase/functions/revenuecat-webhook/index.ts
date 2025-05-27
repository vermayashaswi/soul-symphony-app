
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Log the webhook event
    const { error: logError } = await supabase
      .from('revenuecat_webhook_events')
      .insert({
        event_type: webhookData.event.type,
        revenuecat_user_id: webhookData.event.original_app_user_id,
        app_user_id: webhookData.event.app_user_id,
        product_id: webhookData.event.product_id,
        event_timestamp: new Date(webhookData.event.purchased_at_ms).toISOString(),
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
      .eq('revenuecat_user_id', webhookData.event.original_app_user_id)
      .single();

    if (customerError || !customer) {
      console.error('Customer not found for webhook event:', customerError);
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process different event types
    switch (webhookData.event.type) {
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
        
      default:
        console.log('Unhandled event type:', webhookData.event.type);
    }

    // Mark webhook as processed
    await supabase
      .from('revenuecat_webhook_events')
      .update({ 
        processed: true, 
        processed_at: new Date().toISOString() 
      })
      .eq('revenuecat_user_id', webhookData.event.original_app_user_id)
      .eq('event_type', webhookData.event.type)
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

  console.log(`Successfully processed ${event.type} event for customer ${customer.id}`);
}
