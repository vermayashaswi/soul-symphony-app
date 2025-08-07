import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InitRequest {
  userId: string;
  platform: 'android' | 'ios' | 'web';
  getApiKeyOnly?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('RevenueCat initialization request received');
    
    // Create authenticated client using the JWT token from the request
    const authHeader = req.headers.get('Authorization');
    let supabase;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use the user's JWT token for authenticated context
      console.log('Using authenticated context for user operations');
      supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        }
      );
    } else {
      // Fallback to service role for non-authenticated operations
      console.log('Using service role for fallback operations');
      supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
    }

    const { userId, platform, getApiKeyOnly }: InitRequest = await req.json();
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get RevenueCat API key from Supabase secrets
    const revenueCatApiKey = Deno.env.get('REVENUECAT_API_KEY');
    if (!revenueCatApiKey) {
      throw new Error('RevenueCat API key not configured in Supabase secrets');
    }

    // If only API key is requested, return it immediately
    if (getApiKeyOnly) {
      console.log(`Returning API key for user: ${userId}, platform: ${platform}`);
      return new Response(
        JSON.stringify({
          success: true,
          apiKey: revenueCatApiKey
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    console.log(`Initializing RevenueCat for user: ${userId}, platform: ${platform}`);

    // Get or create RevenueCat customer with better error handling
    let customer = null;
    try {
      const { data: existingCustomer, error: customerError } = await supabase
        .from('revenuecat_customers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (customerError && customerError.code !== 'PGRST116') {
        console.error('Error fetching customer:', customerError);
        // Don't throw - continue with fallback
      } else {
        customer = existingCustomer;
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
          // Don't throw - use fallback customer data
          customer = {
            id: userId,
            user_id: userId,
            revenuecat_customer_id: userId,
            platform: platform,
            app_store_country: platform === 'ios' ? 'US' : null,
            play_store_country: platform === 'android' ? 'US' : null,
          };
        } else {
          customer = newCustomer;
        }
      }
    } catch (error) {
      console.error('Customer operations failed, using fallback:', error);
      customer = {
        id: userId,
        user_id: userId,
        revenuecat_customer_id: userId,
        platform: platform,
        app_store_country: platform === 'ios' ? 'US' : null,
        play_store_country: platform === 'android' ? 'US' : null,
      };
    }

    // Check for existing active subscriptions with error handling
    let subscriptions = [];
    try {
      const { data: subs, error: subsError } = await supabase
        .from('revenuecat_subscriptions')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('status', 'active');

      if (subsError) {
        console.error('Error fetching subscriptions:', subsError);
        // Continue with empty subscriptions rather than failing
      } else {
        subscriptions = subs || [];
      }
    } catch (error) {
      console.error('Subscription fetch failed, continuing with empty list:', error);
      subscriptions = [];
    }

    console.log(`Found ${subscriptions?.length || 0} active subscriptions`);

    // Try to fetch products from RevenueCat API
    let products = [];
    try {
      const revenueCatResponse = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}/offerings`, {
        headers: {
          'Authorization': `Bearer ${revenueCatApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (revenueCatResponse.ok) {
        const offeringsData = await revenueCatResponse.json();
        if (offeringsData.offerings && offeringsData.offerings.length > 0) {
          const currentOffering = offeringsData.offerings[0];
          products = currentOffering.packages?.map((pkg: any) => ({
            identifier: pkg.identifier,
            title: pkg.product?.display_name || 'Soulo Premium Monthly',
            description: pkg.product?.description || 'Unlock unlimited voice journaling with AI insights',
            price: pkg.product?.price || 9.99,
            priceString: pkg.product?.price_string || '$9.99',
            currency: pkg.product?.currency || 'USD',
            introPrice: pkg.product?.intro_price ? {
              price: pkg.product.intro_price.price || 0,
              priceString: pkg.product.intro_price.price_string || 'Free',
              period: pkg.product.intro_price.period || 'P7D',
              cycles: pkg.product.intro_price.cycles || 1
            } : undefined
          })) || [];
        }
      }
    } catch (apiError) {
      console.warn('Failed to fetch products from RevenueCat API:', apiError);
    }

    // Fallback products if API call failed
    if (products.length === 0) {
      products = [
        {
          identifier: platform === 'ios' ? 'soulo_premium_monthly_ios' : platform === 'android' ? 'soulo_premium_monthly_android' : 'soulo_premium_monthly_web',
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
    }

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