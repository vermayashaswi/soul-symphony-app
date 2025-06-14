
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
const twilioServiceSid = Deno.env.get('TWILIO_SERVICE_SID')!

const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phoneNumber, userId, countryCode } = await req.json()

    console.log('SMS verification request:', { phoneNumber, userId, countryCode })

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Enhanced phone number validation with country code support
    let formattedPhone = phoneNumber.trim()
    if (!formattedPhone.startsWith('+')) {
      // Add country code if provided
      if (countryCode) {
        formattedPhone = `+${countryCode}${formattedPhone}`
      } else {
        formattedPhone = `+${formattedPhone}`
      }
    }

    // More comprehensive E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    if (!phoneRegex.test(formattedPhone)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid phone number format. Please use international format (e.g., +1234567890)',
          suggestion: 'Make sure to include country code'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check rate limiting
    const { data: rateLimitResult, error: rateLimitError } = await supabase
      .rpc('check_sms_rate_limit', {
        p_phone_number: formattedPhone,
        p_user_id: userId
      })

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError)
      return new Response(
        JSON.stringify({ error: 'Failed to check rate limits' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many SMS requests. Please try again later.',
          retryAfter: rateLimitResult.retry_after,
          isRateLimited: true
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    // Store verification code in database
    const { error: dbError } = await supabase
      .from('phone_verifications')
      .insert({
        phone_number: formattedPhone,
        verification_code: verificationCode,
        user_id: userId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to store verification code' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Send SMS via Twilio using Verify Service for better deliverability
    const twilioUrl = `https://verify.twilio.com/v2/Services/${twilioServiceSid}/Verifications`
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`)

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        Channel: 'sms'
      })
    })

    if (!twilioResponse.ok) {
      const twilioError = await twilioResponse.text()
      console.error('Twilio error:', twilioError)
      
      // Parse Twilio error for better user feedback
      let errorMessage = 'Failed to send SMS'
      if (twilioError.includes('phone number')) {
        errorMessage = 'Invalid phone number. Please check the number and try again.'
      } else if (twilioError.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait before trying again.'
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const twilioResult = await twilioResponse.json()
    console.log('Twilio verification sent:', twilioResult.status)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification code sent successfully',
        expiresIn: 600, // 10 minutes in seconds
        phoneNumber: formattedPhone,
        status: twilioResult.status
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
