
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { analyzeWithGoogleNL } from './nlProcessing.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Environment check: {");
    console.log(`  hasOpenAIKey: ${!!Deno.env.get('OPENAI_API_KEY')},`);
    console.log(`  hasSupabaseUrl: ${!!Deno.env.get('SUPABASE_URL')},`);
    console.log(`  hasSupabaseServiceKey: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')},`);
    console.log(`  hasGoogleNLApiKey: ${!!Deno.env.get('GOOGLE_API')}`);
    console.log("}");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Supabase client initialized successfully");

    const { audioData, userId, highQuality = true, directTranscription = false } = await req.json();
    
    console.log("Received audio data, processing...");
    console.log(`User ID: ${userId}`);
    console.log(`Direct transcription mode: ${directTranscription ? 'YES' : 'NO'}`);
    console.log(`High quality mode: ${highQuality ? 'YES' : 'NO'}`);
    console.log(`Audio data length: ${audioData.length}`);
    
    // Always use the correct transcription model
    const model = "gpt-4o-transcribe"; // Explicitly set the correct model
    console.log(`Using model: ${model}`);

    // Check if user profile exists
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking user profile:', profileError);
    }

    const profileExists = !!profileData;
    console.log(`User profile exists: ${profileExists ? 'YES' : 'NO'}`);

    if (!profileExists && !directTranscription) {
      console.log('Creating user profile...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{ id: userId }]);

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        throw new Error(`Failed to create user profile: ${insertError.message}`);
      }
      console.log('User profile created successfully');
    }

    // Convert base64 to binary
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`Processed ${Math.ceil(binaryString.length / 8)} chunks into a ${bytes.length} byte array`);
    console.log(`Processed binary audio size: ${bytes.length}`);

    // Check if user profile exists again (in case it was just created)
    if (!directTranscription) {
      const { data: checkProfileData, error: checkProfileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (checkProfileError && checkProfileError.code !== 'PGRST116') {
        console.error('Error checking user profile after creation:', checkProfileError);
      }

      const profileNowExists = !!checkProfileData;
      console.log(`User profile now exists: ${profileNowExists ? 'YES' : 'NO'}`);

      if (!profileNowExists) {
        console.warn('User profile still does not exist after creation attempt');
      }
    }

    // File type detection
    let detectedFileType = 'wav';
    if (bytes.length >= 8) {
      const first8Bytes = Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`First 8 bytes of audio data: ${first8Bytes}`);
      
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        detectedFileType = 'wav';
      } else if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
        detectedFileType = 'mp3';
      } else if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        detectedFileType = 'ogg';
      }
    }
    
    console.log(`Detected file type: ${detectedFileType}`);

    // Store audio file
    const timestamp = Date.now();
    const fileName = `journal-entry-${userId}-${timestamp}.${detectedFileType}`;
    
    console.log(`Storing audio file ${fileName} with size ${bytes.length} bytes`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('journal-audio')
      .upload(fileName, bytes, {
        contentType: `audio/${detectedFileType}`,
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading audio file:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log(`Uploading ${fileName} to journal-audio bucket (audio/${detectedFileType})`);

    const audioUrl = `${supabaseUrl}/storage/v1/object/public/journal-audio/${fileName}`;
    console.log(`File uploaded successfully: ${audioUrl}`);

    // Create blob for transcription
    const audioBlob = new Blob([bytes], { type: `audio/${detectedFileType}` });
    console.log(`Created blob for transcription: { size: ${audioBlob.size}, type: "${audioBlob.type}", detectedFileType: "${detectedFileType}" }`);

    // Send to OpenAI API for transcription
    console.log("Sending audio to OpenAI API for transcription");
    console.log(`Using model: ${model}`); // Log the model being used

    const formData = new FormData();
    formData.append('file', audioBlob, `audio.${detectedFileType}`);
    formData.append('model', model); // Use the verified model
    
    console.log(`[Transcription] Using filename: audio.${detectedFileType}`);
    console.log(`[Transcription] Preparing audio for OpenAI: { blobSize: ${audioBlob.size}, blobType: "${audioBlob.type}", fileExtension: "${detectedFileType}" }`);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found');
    }

    console.log(`[Transcription] Sending request to OpenAI with: {`);
    console.log(`  fileSize: ${audioBlob.size},`);
    console.log(`  fileType: "${audioBlob.type}",`);
    console.log(`  fileExtension: "${detectedFileType}",`);
    console.log(`  hasApiKey: ${!!openaiApiKey},`);
    console.log(`  model: "${model}",`);
    console.log(`  autoLanguageDetection: true`);
    console.log(`}`);

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${transcriptionResponse.status} - ${errorText}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcribedText = transcriptionResult.text;

    console.log(`[Transcription] Success: {`);
    console.log(`  textLength: ${transcribedText.length},`);
    console.log(`  sampleText: "${transcribedText.slice(0, 50)}${transcribedText.length > 50 ? '....' : ''}",`);
    console.log(`  model: "${model}",`);
    console.log(`  detectedLanguage: "${transcriptionResult.language || 'unknown'}"`);
    console.log(`}`);

    console.log(`Transcription successful: ${transcribedText ? 'yes' : 'no'}`);

    // Detect language
    let primaryLanguage = transcriptionResult.language || 'en';
    console.log(`Primary detected language: ${primaryLanguage}`);

    // Enhanced language detection using Google API for additional languages
    let detectedLanguages = [primaryLanguage];
    
    const googleApiKey = Deno.env.get('GOOGLE_API');
    if (googleApiKey && transcribedText.length > 10) {
      try {
        console.log('Performing enhanced language detection with Google API...');
        const detectResponse = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: transcribedText })
        });

        if (detectResponse.ok) {
          const detectData = await detectResponse.json();
          if (detectData.data && detectData.data.detections && detectData.data.detections[0]) {
            const googleDetected = detectData.data.detections[0][0].language;
            const confidence = detectData.data.detections[0][0].confidence || 0;
            
            console.log(`Google detected language: ${googleDetected} (confidence: ${confidence})`);
            
            // Add Google's detection if it's different and has reasonable confidence
            if (googleDetected !== primaryLanguage && confidence > 0.5) {
              detectedLanguages.push(googleDetected);
            }
          }
        }
      } catch (error) {
        console.error('Error with Google language detection:', error);
      }
    }

    // Additional language detection for mixed-language content
    if (transcribedText.length > 100) {
      try {
        console.log('Analyzing for mixed-language content...');
        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a language detection expert. Analyze the text and identify all languages present. Return ONLY a JSON array of ISO 639-1 language codes (e.g., ["en", "es", "hi"]). Be conservative - only include languages that are clearly present with substantial content.'
              },
              {
                role: 'user',
                content: `Analyze this text for multiple languages: "${transcribedText}"`
              }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
            max_tokens: 200
          }),
        });

        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json();
          try {
            const languageAnalysis = JSON.parse(analysisResult.choices[0].message.content);
            if (languageAnalysis.languages && Array.isArray(languageAnalysis.languages)) {
              // Merge with existing detected languages, removing duplicates
              const allLanguages = [...new Set([...detectedLanguages, ...languageAnalysis.languages])];
              detectedLanguages = allLanguages;
              console.log(`Enhanced language detection result: ${JSON.stringify(detectedLanguages)}`);
            }
          } catch (parseError) {
            console.error('Error parsing language analysis:', parseError);
          }
        }
      } catch (error) {
        console.error('Error with enhanced language detection:', error);
      }
    }

    console.log(`Final detected languages: ${JSON.stringify(detectedLanguages)}`);

    // If direct transcription mode, return the result immediately
    if (directTranscription) {
      console.log('Direct transcription mode, returning result immediately');
      return new Response(JSON.stringify({
        transcription: transcribedText,
        language: primaryLanguage,
        languages: detectedLanguages,
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refine the transcription with GPT-4
    console.log('Refining transcription with GPT-4...');
    
    const refinementResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that refines transcribed text from voice recordings. 
            Your task is to correct any obvious transcription errors, add proper punctuation, and format the text into clear paragraphs.
            Maintain the original meaning and all factual content. Do not add new information or change the substance of what was said.
            If the text is in a language other than English, maintain that language - do not translate.
            Preserve all personal names, places, and specific terms exactly as they appear.`
          },
          {
            role: 'user',
            content: `Please refine this transcribed text from a voice recording: "${transcribedText}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!refinementResponse.ok) {
      console.error('Error refining transcription:', await refinementResponse.text());
      throw new Error('Failed to refine transcription');
    }

    const refinementResult = await refinementResponse.json();
    const refinedText = refinementResult.choices[0].message.content;

    console.log('Transcription refined successfully');
    console.log(`Original length: ${transcribedText.length}, Refined length: ${refinedText.length}`);
    console.log(`Refined sample: "${refinedText.slice(0, 50)}${refinedText.length > 50 ? '...' : ''}"`);

    // Analyze sentiment with Google NL API
    console.log('Analyzing sentiment with Google NL API...');
    const googleNLApiKey = Deno.env.get('GOOGLE_API');
    
    let sentimentResult = { sentiment: "0" };
    
    if (googleNLApiKey) {
      try {
        sentimentResult = await analyzeWithGoogleNL(refinedText, googleNLApiKey);
        console.log(`Sentiment analysis result: ${sentimentResult.sentiment}`);
      } catch (sentimentError) {
        console.error('Error analyzing sentiment:', sentimentError);
        console.log('Continuing with default sentiment value of 0');
      }
    } else {
      console.warn('Google NL API key not found, skipping sentiment analysis');
    }

    // Store in database with detected languages
    console.log('Storing journal entry in database...');
    
    const { data: journalEntry, error: insertError } = await supabase
      .from('Journal Entries')
      .insert([
        {
          user_id: userId,
          "transcription text": transcribedText,
          "refined text": refinedText,
          audio_url: audioUrl,
          sentiment: sentimentResult.sentiment,
          languages: detectedLanguages, // Store the detected languages
          duration: null // Will be updated later if available
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting journal entry:', insertError);
      throw new Error(`Failed to store journal entry: ${insertError.message}`);
    }

    console.log(`Journal entry stored successfully with ID: ${journalEntry.id}`);
    console.log(`Stored languages: ${JSON.stringify(detectedLanguages)}`);

    // Analyze emotions and themes with GPT-4
    console.log('Analyzing emotions and themes with GPT-4...');
    
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert psychological analysis system. Analyze the journal entry for emotions and themes.
            Return ONLY a JSON object with the following structure:
            {
              "emotions": {
                "emotion1": score, // 0.0 to 1.0 where 1.0 is strongest
                "emotion2": score,
                // Include all emotions detected with score > 0.1
              },
              "master_themes": ["theme1", "theme2", "theme3"] // 3-5 main themes
            }
            Do not include any explanations or text outside the JSON object.`
          },
          {
            role: 'user',
            content: refinedText
          }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        max_tokens: 800
      }),
    });

    if (!analysisResponse.ok) {
      console.error('Error analyzing emotions and themes:', await analysisResponse.text());
      throw new Error('Failed to analyze emotions and themes');
    }

    const analysisResult = await analysisResponse.json();
    let analysis;
    
    try {
      analysis = JSON.parse(analysisResult.choices[0].message.content);
      console.log('Emotion and theme analysis successful');
    } catch (parseError) {
      console.error('Error parsing analysis result:', parseError);
      console.log('Raw analysis result:', analysisResult.choices[0].message.content);
      analysis = { emotions: {}, master_themes: [] };
    }

    // Update journal entry with emotions and themes
    console.log('Updating journal entry with emotions and themes...');
    
    const { error: updateError } = await supabase
      .from('Journal Entries')
      .update({
        emotions: analysis.emotions || {},
        master_themes: analysis.master_themes || []
      })
      .eq('id', journalEntry.id);

    if (updateError) {
      console.error('Error updating journal entry with analysis:', updateError);
    } else {
      console.log('Journal entry updated with emotions and themes');
    }

    // Generate embeddings for vector search
    console.log('Generating embeddings for vector search...');
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: refinedText,
        encoding_format: 'float'
      }),
    });

    if (!embeddingResponse.ok) {
      console.error('Error generating embeddings:', await embeddingResponse.text());
      throw new Error('Failed to generate embeddings');
    }

    const embeddingResult = await embeddingResponse.json();
    const embedding = embeddingResult.data[0].embedding;

    console.log(`Embedding generated successfully with ${embedding.length} dimensions`);

    // Store embeddings
    console.log('Storing embeddings...');
    
    const { error: embeddingError } = await supabase.rpc('upsert_journal_embedding', {
      entry_id: journalEntry.id,
      embedding_vector: embedding
    });

    if (embeddingError) {
      console.error('Error storing embeddings:', embeddingError);
    } else {
      console.log('Embeddings stored successfully');
    }

    // Return success response
    console.log('Processing complete, returning success response');
    
    return new Response(JSON.stringify({
      id: journalEntry.id,
      transcription: transcribedText,
      refined: refinedText,
      emotions: analysis.emotions,
      themes: analysis.master_themes,
      sentiment: sentimentResult.sentiment,
      language: primaryLanguage,
      languages: detectedLanguages,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in transcribe-audio function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
