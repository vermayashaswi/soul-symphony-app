import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InitRequest {
  userId: string;
  platform: 'android' | 'ios';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('RevenueCat initialization request received');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { userId, platform }: InitRequest = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`Initializing RevenueCat for user: ${userId}, platform: ${platform}`);

    // Get or create RevenueCat customer
    let { data: customer, error: customerError } = await supabase
      .from('revenuecat_customers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (customerError && customerError.code !== 'PGRST116') {
      console.error('Error fetching customer:', customerError);
      throw customerError;
    }

    if (!customer) {
      console.log('Creating new RevenueCat customer');
      const { data: newCustomer, error: createError } = await supabase
        .from('revenuecat_customers')
        .insert({
          user_id: userId,
          revenuecat_customer_id: userId, // Use user ID as customer ID
          platform: platform,
          app_store_country: platform === 'ios' ? 'US' : null,
          play_store_country: platform === 'android' ? 'US' : null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating customer:', createError);
        throw createError;
      }
      customer = newCustomer;
    }

    // Check for existing active subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('revenuecat_subscriptions')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('status', 'active');

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      throw subsError;
    }

    console.log(`Found ${subscriptions?.length || 0} active subscriptions`);

    // Get available products based on platform
    const products = [
      {
        identifier: platform === 'ios' ? 'soulo_premium_monthly_ios' : 'soulo_premium_monthly_android',
        title: 'Soulo Premium Monthly',
        description: 'Unlock unlimited voice journaling with AI insights',
        price: 9.99,
        priceString: '$9.99',
        currency: 'USD',
        introPrice: {
          price: 0,
          priceString: 'Free',
          period: 'P7D', // 7 days
          cycles: 1
        }
      }
    ];

    const response = {
      success: true,
      customer: {
        id: customer.revenuecat_customer_id,
        platform: customer.platform,
        subscriptions: subscriptions || []
      },
      products,
      hasActiveSubscription: (subscriptions?.length || 0) > 0
    };

    console.log('RevenueCat initialization successful');
    
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
    console.error('RevenueCat initialization error:', error);
    
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