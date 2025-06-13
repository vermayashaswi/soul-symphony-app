
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phoneNumber, code, userId } = await req.json()

    if (!phoneNumber || !code) {
      return new Response(
        JSON.stringify({ error: 'Phone number and verification code are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the code using the database function
    const { data: verificationResult, error: verificationError } = await supabase
      .rpc('verify_phone_code', {
        p_phone_number: phoneNumber,
        p_code: code,
        p_user_id: userId
      })

    if (verificationError) {
      console.error('Verification error:', verificationError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify code' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!verificationResult.success) {
      let errorMessage = 'Invalid verification code'
      if (verificationResult.error === 'verification_expired') {
        errorMessage = 'Verification code has expired'
      } else if (verificationResult.error === 'invalid_code') {
        errorMessage = 'Invalid verification code'
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        verified: true,
        message: 'Phone number verified successfully' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
