
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function uploadAudioFile(audioData: Uint8Array, userId: string): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}.webm`;
    
    console.log(`Uploading audio file: ${filename}, size: ${audioData.length} bytes`);
    
    // Create a blob from the audio data
    const blob = new Blob([audioData], { type: 'audio/webm' });
    
    // Upload the file to Supabase storage
    const { data, error } = await supabase.storage
      .from('journal-audio')
      .upload(filename, blob, {
        contentType: 'audio/webm',
        upsert: true
      });
      
    if (error) {
      console.error('Error uploading audio file:', error);
      return null;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('journal-audio')
      .getPublicUrl(filename);
      
    console.log('Audio file uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadAudioFile:', error);
    return null;
  }
}
